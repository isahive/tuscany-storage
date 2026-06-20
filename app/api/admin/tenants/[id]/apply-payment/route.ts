import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { Types } from 'mongoose'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Payment from '@/models/Payment'
import { nextBalanceAfter } from '@/lib/paymentBalance'
import { syncTenantStatusFromBalance } from '@/lib/tenantStatus'
import { withTxn } from '@/lib/withTxn'

interface RouteContext {
  params: Promise<{ id: string }>
}

const schema = z.object({
  /** Total payment amount in cents */
  amount: z.number().int().positive(),
  /** Line item Payment._id list to mark as paid */
  itemIds: z.array(z.string()).default([]),
  method: z.enum(['card', 'ach', 'check', 'cash', 'external_cc', 'other']),
  /** When method=card, the confirmed PaymentMethod id from Stripe Elements */
  paymentMethodId: z.string().optional(),
  /** When method=ach, the confirmed PaymentMethod id (us_bank_account) */
  achPaymentMethodId: z.string().optional(),
  /** When method=check */
  checkNumber: z.string().optional(),
  batchNumber: z.string().optional(),
  /** Free-form description for any non-card method */
  description: z.string().optional(),
  /** Save the card/ACH for future use */
  saveForFuture: z.boolean().optional(),
})

/**
 * POST /api/admin/tenants/[id]/apply-payment
 *
 * Records a payment using one of:
 *   card | ach | check | cash | external_cc | other
 *
 * For card/ach the frontend has already created a Stripe PaymentMethod via Elements
 * and confirmed a SetupIntent. We then create a PaymentIntent off-session against
 * that PM. For manual methods (check/cash/external/other) the Payment row is
 * recorded with status=succeeded immediately — no Stripe call.
 *
 * Side-effects:
 *   - Marks selected line-item Payments as status=succeeded
 *   - Creates a "payment" Payment row (type=rent for card/ach, type=other for manual)
 *   - Subtracts the amount from tenant.balance
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    await connectDB()
    const tenant = await Tenant.findById(id).select('+stripeCustomerId +defaultPaymentMethodId')
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const { amount, itemIds, method, paymentMethodId, achPaymentMethodId,
      checkNumber, batchNumber, description, saveForFuture } = parsed.data

    let stripePaymentIntentId: string | undefined
    let stripeChargeId: string | undefined
    let paymentStatus: 'succeeded' | 'pending' | 'failed' = 'succeeded'
    let failureReason: string | undefined

    // ── Stripe-backed methods ──
    if (method === 'card' || method === 'ach') {
      const pmId = method === 'card' ? paymentMethodId : achPaymentMethodId
      if (!pmId) {
        return NextResponse.json({ success: false, error: 'Missing payment method id' }, { status: 400 })
      }
      if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 })
      }

      const { stripe } = await import('@/lib/stripe')

      if (!tenant.stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: tenant.email,
          name: `${tenant.firstName} ${tenant.lastName}`,
          phone: tenant.phone,
          metadata: { tenantId: String(tenant._id) },
        })
        tenant.stripeCustomerId = customer.id
      }

      const pm = await stripe.paymentMethods.retrieve(pmId)
      if (!pm.customer) {
        await stripe.paymentMethods.attach(pmId, { customer: tenant.stripeCustomerId! })
      }

      try {
        const intent = await stripe.paymentIntents.create({
          amount,
          currency: 'usd',
          customer: tenant.stripeCustomerId,
          payment_method: pmId,
          payment_method_types: method === 'card' ? ['card'] : ['us_bank_account'],
          confirm: true,
          off_session: true,
          metadata: {
            tenantId: String(tenant._id),
            method,
            itemIds: itemIds.join(','),
          },
        })

        stripePaymentIntentId = intent.id
        stripeChargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : undefined

        if (intent.status === 'succeeded') {
          paymentStatus = 'succeeded'
        } else if (intent.status === 'requires_payment_method' || intent.status === 'canceled') {
          paymentStatus = 'failed'
          failureReason = intent.last_payment_error?.message ?? `Stripe status: ${intent.status}`
        } else {
          // ACH stays 'pending' until clearing (3-5 business days)
          paymentStatus = 'pending'
        }
      } catch (stripeErr: any) {
        // Stripe threw — typically a CardError (declined, expired, etc.).
        // Log the failed attempt in billing history without touching balance.
        paymentStatus = 'failed'
        stripePaymentIntentId = stripeErr?.payment_intent?.id
        stripeChargeId = stripeErr?.payment_intent?.latest_charge
        failureReason = stripeErr?.message ?? 'Card declined'
      }

      if (paymentStatus === 'succeeded' && saveForFuture) {
        await stripe.customers.update(tenant.stripeCustomerId!, {
          invoice_settings: { default_payment_method: pmId },
        })
        tenant.defaultPaymentMethodId = pmId
      }

      // Persist any Stripe customer / default-PM linkage created above BEFORE
      // the balance transaction, which re-reads the tenant fresh and would
      // otherwise drop these in-memory edits.
      await tenant.save()
    }

    // ── Record the payment ──
    const baseDescription = (() => {
      const desc = description?.trim()
      switch (method) {
        case 'card':         return desc ? `One Time Credit Card — ${desc}` : 'One Time Credit Card'
        case 'ach':          return desc ? `One Time ACH — ${desc}` : 'One Time ACH'
        case 'check':        return `Check${checkNumber ? ` #${checkNumber}` : ''}${batchNumber ? ` (batch ${batchNumber})` : ''}${desc ? ` — ${desc}` : ''}`
        case 'cash':         return `Cash${batchNumber ? ` (batch ${batchNumber})` : ''}${desc ? ` — ${desc}` : ''}`
        case 'external_cc':  return desc ? `External CC Machine — ${desc}` : 'External CC Machine'
        case 'other':        return desc ? `Other — ${desc}` : 'Other'
      }
    })()

    // For failed attempts, append the decline reason so it surfaces in the
    // billing history description (mirrors Storable's "Transaction declined: …").
    const paymentDescription = paymentStatus === 'failed' && failureReason
      ? `${baseDescription} — Transaction declined: ${failureReason}`
      : baseDescription

    // Resolve charge rows this payment is settling so the Refund screen can
    // list line items the way Storable Easy does.
    const appliedToObjectIds = itemIds
      .filter((s) => Types.ObjectId.isValid(s))
      .map((s) => new Types.ObjectId(s))

    // Record the payment row, settle line items and move the balance as ONE
    // atomic unit. The balance read-modify-write lives inside the callback so
    // withTransaction can retry it on a write conflict (two admins posting
    // payments for the same tenant at once) without losing an update.
    let finalBalance = tenant.balance ?? 0
    const paymentRow = await withTxn(async (txnSession) => {
      const balanceAfter = await nextBalanceAfter(
        Payment,
        tenant._id,
        { direction: 'payment', status: paymentStatus, amount },
        txnSession,
      )

      const [row] = await Payment.create([{
        tenantId: tenant._id,
        amount,
        currency: 'usd',
        type: method === 'card' || method === 'ach' ? 'rent' : 'other',
        status: paymentStatus,
        direction: 'payment',
        balanceAfter,
        stripePaymentIntentId,
        stripeChargeId,
        description: paymentDescription,
        failureReason,
        createdBy: session.user.id,
        attemptCount: 1,
        lastAttemptAt: new Date(),
        appliedToItemIds: appliedToObjectIds.length > 0 ? appliedToObjectIds : undefined,
      }], { session: txnSession })

      // Only confirmed-succeeded payments touch line items and balance.
      // Pending (ACH awaiting clearing) and failed attempts are logged but the
      // money is treated as not-yet-moved — a webhook later promotes a pending
      // row to succeeded (or to failed) and re-runs this reconciliation.
      if (paymentStatus === 'succeeded') {
        if (appliedToObjectIds.length > 0) {
          await Payment.updateMany(
            { _id: { $in: appliedToObjectIds }, tenantId: tenant._id, status: 'pending' },
            { $set: { status: 'succeeded', lastAttemptAt: new Date() } },
            { session: txnSession },
          )
        }

        // Re-read the tenant inside the transaction so a concurrent payment
        // can't clobber this balance update (the doc write is the conflict
        // point that triggers a safe retry).
        const fresh = await Tenant.findById(id).session(txnSession ?? null)
        if (fresh) {
          fresh.balance = (fresh.balance ?? 0) - amount
          syncTenantStatusFromBalance(fresh)
          await fresh.save({ session: txnSession })
          finalBalance = fresh.balance ?? 0
        }
      }

      return row
    })

    return NextResponse.json({
      success: paymentStatus !== 'failed',
      data: {
        paymentId: String(paymentRow._id),
        status: paymentStatus,
        balance: finalBalance,
        stripePaymentIntentId,
      },
      error: paymentStatus === 'failed' ? (failureReason ?? 'Payment failed') : undefined,
    }, { status: paymentStatus === 'failed' ? 402 : 200 })
  } catch (error: any) {
    const message = error?.message ?? 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
