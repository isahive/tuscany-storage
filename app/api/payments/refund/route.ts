import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Types } from 'mongoose'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Payment from '@/models/Payment'
import Tenant from '@/models/Tenant'
import { nextBalanceAfter } from '@/lib/paymentBalance'

const REFUND_METHOD_LABEL: Record<string, string> = {
  return_to_card: 'Return to Credit Card',
  cash: 'Cash',
  check: 'Check',
  other: 'Other',
}

const refundSchema = z.object({
  paymentId: z.string().min(1),
  /** Refund amount in dollars. Omit or pass the full amount for a full refund. */
  amount: z.number().positive().optional(),
  /** Optional subset of charge-row Payment ids to revert to pending so the
   *  resulting balance reflects the line items the refund covers. */
  lineItemIds: z.array(z.string()).optional(),
  method: z.enum(['return_to_card', 'cash', 'check', 'other']).optional(),
  reason: z.string().optional(),
})

/**
 * POST /api/payments/refund
 *
 * Mirrors Storable Easy's Refunding Payments flow:
 *   - Creates a NEW direction='payment' status='refunded' row recording the
 *     refund (this is the line item that surfaces in Billing History).
 *   - Reduces the original payment's `amount` by the refund amount, so the
 *     original payment row reflects the new effective amount. A fully-refunded
 *     payment ends up with amount=0 and status='refunded'.
 *   - If `lineItemIds` are provided, reverts those charge rows from
 *     status='succeeded' back to 'pending', so the tenant is shown as owing
 *     them again. Storable expects admins to then Mass Void from the customer
 *     billing screen — we leave that to the admin.
 *   - Updates tenant.balance via the standard balance delta (refund row
 *     contributes 0 to balance, but the line-items revert does).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = refundSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    const { paymentId, amount, lineItemIds, method, reason } = parsed.data

    await connectDB()

    const payment = await Payment.findById(paymentId)
    if (!payment) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 })
    if (payment.direction !== 'payment') {
      return NextResponse.json({ success: false, error: 'Only payment rows can be refunded' }, { status: 422 })
    }
    if (payment.status !== 'succeeded') {
      return NextResponse.json({ success: false, error: 'Can only refund succeeded payments' }, { status: 422 })
    }

    const refundAmountCents = amount ? Math.round(amount * 100) : payment.amount
    if (refundAmountCents <= 0 || refundAmountCents > payment.amount) {
      return NextResponse.json({ success: false, error: 'Refund amount exceeds payment amount' }, { status: 422 })
    }

    // ── If the original payment went through Stripe, mirror it ──
    if (payment.stripePaymentIntentId && process.env.STRIPE_SECRET_KEY) {
      const { stripe } = await import('@/lib/stripe')
      await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: refundAmountCents,
        reason: 'requested_by_customer',
        metadata: {
          paymentId: String(payment._id),
          refundedBy: session.user.id,
          note: reason ?? '',
        },
      })
    } else if (payment.stripePaymentIntentId) {
      console.log(`[DEV STRIPE] Mock refund: ${refundAmountCents} cents for payment ${paymentId}`)
    }

    // ── Adjust the original payment row ──
    // Storable shows the original payment's amount as reduced by the refund.
    const remaining = payment.amount - refundAmountCents
    payment.amount = remaining
    if (remaining === 0) payment.status = 'refunded'
    await payment.save()

    // ── Revert any chosen line items so the tenant owes them again ──
    let revertedAmountCents = 0
    if (lineItemIds && lineItemIds.length > 0) {
      const ids = lineItemIds
        .filter((s) => Types.ObjectId.isValid(s))
        .map((s) => new Types.ObjectId(s))
      const items = await Payment.find({
        _id: { $in: ids },
        tenantId: payment.tenantId,
        direction: 'charge',
        status: 'succeeded',
      })
      for (const it of items) {
        revertedAmountCents += it.amount
        it.status = 'pending'
        await it.save()
      }
    }

    // ── Record the refund row (this is what surfaces in Billing History) ──
    const methodLabel = method ? REFUND_METHOD_LABEL[method] : (payment.stripePaymentIntentId ? 'Return to Credit Card' : 'Other')
    const descParts = [`Refund — ${methodLabel}`]
    if (reason && reason.trim()) descParts.push(reason.trim())
    const refundDescription = descParts.join(' — ')

    // The ledger effect of a refund is +refundAmount: the original payment
    // row's amount was just reduced, so it subtracts less on recompute. The
    // refund row itself contributes 0 (see balanceDelta), and reverting line
    // items only flips their status back to pending — charges count toward
    // the balance regardless of status, so the flips are display-only.
    const balanceAfter = await nextBalanceAfter(Payment, payment.tenantId, {
      direction: 'payment',
      status: 'refunded',
      amount: refundAmountCents,
    }) + refundAmountCents

    const refundRow = await Payment.create({
      tenantId: payment.tenantId,
      leaseId: payment.leaseId,
      unitId: payment.unitId,
      amount: refundAmountCents,
      currency: 'usd',
      type: payment.type,
      status: 'refunded',
      direction: 'payment',
      balanceAfter,
      description: refundDescription,
      refundOfPaymentId: payment._id,
      refundReason: reason,
      refundMethod: method,
      createdBy: session.user.id,
      lastAttemptAt: new Date(),
    })

    // ── Update tenant balance + status ──
    // Mirror the ledger: +refundAmount, whether or not line items were
    // reverted. (It used to add only the reverted amount, so refunding
    // without reverting items left tenant.balance lagging the recompute
    // until the balance route self-healed it.)
    const { syncTenantStatusFromBalance } = await import('@/lib/tenantStatus')
    const refundedTenant = await Tenant.findById(payment.tenantId)
    if (refundedTenant) {
      refundedTenant.balance = (refundedTenant.balance ?? 0) + refundAmountCents
      syncTenantStatusFromBalance(refundedTenant)
      await refundedTenant.save()
    }

    return NextResponse.json({
      success: true,
      data: {
        refundedAmount: refundAmountCents,
        refundPaymentId: String(refundRow._id),
        revertedAmount: revertedAmountCents,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
