import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import {
  getVerificationStatus,
  recordPaymentWithoutRental,
  tenantKey,
} from '@/lib/paymentVerification'
import { verifyTurnstileToken } from '@/lib/turnstile'

const schema = z.object({
  /** Total in cents. */
  amount: z.number().int().positive(),
  /** Cloudflare Turnstile token — required only when the tenant has tripped
   *  Storable's Web Visitor Verification thresholds. */
  turnstileToken: z.string().optional(),
})

/**
 * POST /api/portal/pay-multi/intent
 *
 * Creates an UN-confirmed PaymentIntent and returns its client_secret so the
 * tenant's browser can call `stripe.confirmCardPayment(clientSecret, { ... })`.
 * That client-side confirm path is what makes 3D Secure / SCA work — server-
 * side `confirm:true` returns `status:requires_action` which surfaces as
 * "Payment confirmation required" in the UI.
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

    const { amount, turnstileToken } = parsed.data

    await connectDB()

    // ── Web Visitor Verification gate ──
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

    // Storable parity: paying without an active rental trips verification on
    // the NEXT attempt rather than blocking this one outright.
    if (!lease) {
      await recordPaymentWithoutRental(vKey)
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      // Dev fallback — no real Stripe; return a mock client_secret the
      // frontend can detect and skip confirmCardPayment.
      return NextResponse.json({
        success: true,
        data: { clientSecret: null, devMode: true },
      })
    }

    const { stripe } = await import('@/lib/stripe')

    let customerId = tenant.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        name: `${tenant.firstName} ${tenant.lastName}`,
        metadata: { tenantId: String(tenant._id) },
      })
      customerId = customer.id
      tenant.stripeCustomerId = customerId
      await tenant.save()
    }

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customerId,
      payment_method_types: ['card'],
      // No `confirm:true` — frontend will call `stripe.confirmCardPayment` so
      // 3DS challenge can be presented to the user when required.
      setup_future_usage: 'off_session', // lets the tenant opt-in to saving later
      metadata: {
        tenantId: session.user.id,
        leaseId: lease?._id?.toString() ?? '',
        selfPay: 'true',
      },
    }, {
      idempotencyKey: `portal-pay-intent-${session.user.id}-${amount}-${Date.now()}`,
    })

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        devMode: false,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
