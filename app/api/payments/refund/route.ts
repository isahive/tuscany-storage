import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Payment from '@/models/Payment'
import Tenant from '@/models/Tenant'

const refundSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive().optional(), // partial refund in dollars; omit for full
  reason: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = refundSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const { paymentId, amount, reason } = parsed.data

    await connectDB()

    const payment = await Payment.findById(paymentId)
    if (!payment) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 })
    if (payment.status !== 'succeeded') {
      return NextResponse.json({ success: false, error: 'Can only refund succeeded payments' }, { status: 422 })
    }

    const refundAmountCents = amount ? Math.round(amount * 100) : payment.amount

    if (refundAmountCents > payment.amount) {
      return NextResponse.json({ success: false, error: 'Refund amount exceeds payment amount' }, { status: 422 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      // Dev mode
      console.log(`[DEV STRIPE] Mock refund: ${refundAmountCents} cents for payment ${paymentId}`)
    } else {
      const { stripe } = await import('@/lib/stripe')
      await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: refundAmountCents,
        reason: 'requested_by_customer',
        metadata: {
          paymentId: payment._id.toString(),
          refundedBy: session.user.id,
          note: reason ?? '',
        },
      })
    }

    payment.status = 'refunded'
    await payment.save()

    // Update tenant balance (reduce by refund amount)
    await Tenant.findByIdAndUpdate(payment.tenantId, {
      $inc: { balance: -refundAmountCents },
    })

    return NextResponse.json({ success: true, data: { refundedAmount: refundAmountCents } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
