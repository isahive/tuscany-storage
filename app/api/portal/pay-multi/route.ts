import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import { nextBalanceAfter } from '@/lib/paymentBalance'
import { syncTenantStatusFromBalance } from '@/lib/tenantStatus'
import {
  getVerificationStatus,
  recordFailedPayment,
  recordSuccessfulPayment,
  tenantKey,
} from '@/lib/paymentVerification'
import { verifyTurnstileToken } from '@/lib/turnstile'

const schema = z.object({
  /** Amount in cents the tenant is paying. */
  amount: z.number().int().positive(),
  /** PaymentIntent id confirmed by `stripe.confirmCardPayment` on the frontend.
   *  Omitted in dev mode (no Stripe key) — we then synthesise a mock id. */
  paymentIntentId: z.string().optional(),
  /** When true, set the confirmed PM as the customer's default for future
   *  charges (autopay, off-session billing). */
  saveForFuture: z.boolean().optional(),
  /** Cloudflare Turnstile token — required only when verification is active. */
  turnstileToken: z.string().optional(),
})

/**
 * POST /api/portal/pay-multi
 *
 * Finalizes a tenant-initiated payment AFTER the frontend has confirmed the
 * PaymentIntent via `stripe.confirmCardPayment(clientSecret, ...)`. This is
 * the standard Stripe pattern for on-session payments — server-side
 * `confirm:true` breaks for 3DS / SCA cards.
 *
 * Side-effects on the succeeded path:
 *   - Applies the amount oldest-first against the tenant's pending charges
 *   - Records ONE direction='payment' Payment row referencing the charges it
 *     settled (via `appliedToItemIds`)
 *   - Reduces tenant.balance by the paid amount
 *   - Optionally promotes the confirmed PM to the customer's default
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    const { amount, paymentIntentId, saveForFuture, turnstileToken } = parsed.data

    await connectDB()

    // ── Web Visitor Verification gate (belt + suspenders w/ /intent) ──
    const vKey = tenantKey(session.user.id)
    const vStatus = await getVerificationStatus(vKey)
    if (vStatus.required) {
      const ok = await verifyTurnstileToken(turnstileToken)
      if (!ok) {
        return NextResponse.json(
          {
            success: false,
            error: 'Please complete the verification challenge before continuing.',
            verificationRequired: true,
            reason: vStatus.reason,
          },
          { status: 403 },
        )
      }
    }

    const tenant = await Tenant.findById(session.user.id).select('+stripeCustomerId +defaultPaymentMethodId')
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const lease = await Lease.findOne({
      tenantId: session.user.id,
      status: { $in: ['active', 'pending_moveout'] },
    })

    // ── Verify Stripe payment ──
    let stripeIntentId = paymentIntentId
    let stripeChargeId: string | undefined
    let paymentStatus: 'succeeded' | 'pending' | 'failed' = 'succeeded'

    if (process.env.STRIPE_SECRET_KEY) {
      if (!paymentIntentId) {
        return NextResponse.json({ success: false, error: 'Missing paymentIntentId' }, { status: 400 })
      }
      const { stripe } = await import('@/lib/stripe')
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId)

      if (intent.status === 'succeeded') {
        paymentStatus = 'succeeded'
      } else if (intent.status === 'processing') {
        paymentStatus = 'pending'
      } else {
        // Bump the failed-streak so the Storable "5 in a row" trigger fires
        // even when the decline surfaces only on the finalize step.
        await recordFailedPayment(vKey)
        return NextResponse.json(
          { success: false, error: 'Payment not completed. Please try again.' },
          { status: 402 },
        )
      }

      stripeChargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : undefined

      // Persist the confirmed PM as default if the tenant opted in.
      if (paymentStatus === 'succeeded' && saveForFuture && intent.payment_method && typeof intent.payment_method === 'string' && tenant.stripeCustomerId) {
        try {
          await stripe.customers.update(tenant.stripeCustomerId, {
            invoice_settings: { default_payment_method: intent.payment_method },
          })
          tenant.defaultPaymentMethodId = intent.payment_method
        } catch {/* non-fatal */}
      }
    } else {
      // Dev fallback — no Stripe configured.
      stripeIntentId = `pi_mock_${crypto.randomBytes(12).toString('hex')}`
      console.log(`[DEV STRIPE] Mock tenant payment: ${stripeIntentId} $${(amount / 100).toFixed(2)}`)
    }

    // ── Apply amount oldest-first against pending charge rows ──
    const charges = await Payment.find({
      tenantId: session.user.id,
      status: 'pending',
      direction: 'charge',
    }).sort({ createdAt: 1 })

    let remaining = amount
    const appliedToItemIds: string[] = []
    if (paymentStatus === 'succeeded') {
      for (const c of charges) {
        if (remaining <= 0) break
        const taxed = c.amount + Math.round(c.amount * ((c.taxRate ?? 0) / 100))
        // Live behaviour: partial payments don't half-settle a line item —
        // the line stays pending until fully covered.
        if (remaining >= taxed) {
          c.status = 'succeeded'
          c.lastAttemptAt = new Date()
          await c.save()
          appliedToItemIds.push(String(c._id))
          remaining -= taxed
        }
      }
    }

    // ── Record the payment-direction Payment row ──
    const balanceAfter = await nextBalanceAfter(Payment, tenant._id, {
      direction: 'payment',
      status: paymentStatus,
      amount,
    })

    const description = paymentStatus === 'succeeded'
      ? `One Time Credit Card — Self-pay${remaining > 0 ? ` (${(remaining / 100).toFixed(2)} applied to credit)` : ''}`
      : 'One Time Credit Card — Pending'

    const paymentRow = await Payment.create({
      tenantId: tenant._id,
      leaseId: lease?._id,
      unitId: lease?.unitId,
      amount,
      currency: 'usd',
      type: 'rent',
      status: paymentStatus,
      direction: 'payment',
      balanceAfter,
      stripePaymentIntentId: stripeIntentId,
      stripeChargeId,
      description,
      attemptCount: 1,
      lastAttemptAt: new Date(),
      appliedToItemIds: appliedToItemIds.length > 0 ? appliedToItemIds : undefined,
    })

    // ── Update tenant balance + status ──
    if (paymentStatus === 'succeeded') {
      tenant.balance = (tenant.balance ?? 0) - amount
    }
    syncTenantStatusFromBalance(tenant)
    await tenant.save()

    // Successful payment clears the fail streak, screen-open counter, and any
    // active CAPTCHA requirement. Pending payments leave the state alone.
    if (paymentStatus === 'succeeded') {
      await recordSuccessfulPayment(vKey)
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentId: String(paymentRow._id),
        status: paymentStatus,
        balance: tenant.balance,
        appliedTo: appliedToItemIds.length,
        leftAsCredit: remaining > 0 ? remaining : 0,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
