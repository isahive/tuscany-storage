import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Payment from '@/models/Payment'

const schema = z.object({
  leaseId: z.string(),
  paymentIntentId: z.string().optional(),
  saveCard: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid data' }, { status: 400 })

    const { leaseId, paymentIntentId, saveCard } = parsed.data

    await connectDB()

    const lease = await Lease.findById(leaseId)
    if (!lease) return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })

    const unit = await Unit.findById(lease.unitId)
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })

    let confirmedIntentId = paymentIntentId

    if (process.env.STRIPE_SECRET_KEY) {
      if (!paymentIntentId) {
        return NextResponse.json({ success: false, error: 'Payment confirmation required' }, { status: 400 })
      }
      const { stripe } = await import('@/lib/stripe')
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (intent.status !== 'succeeded') {
        return NextResponse.json({ success: false, error: 'Payment not confirmed. Please try again.' }, { status: 402 })
      }

      // If user opted out of saving card, detach the payment method
      if (saveCard === false && intent.payment_method && typeof intent.payment_method === 'string') {
        try {
          await stripe.paymentMethods.detach(intent.payment_method)
        } catch { /* ignore — PM may not be attached */ }
      }
    } else {
      // Dev mode
      confirmedIntentId = `pi_dev_${crypto.randomBytes(8).toString('hex')}`
    }

    // Keep unit as reserved — it becomes occupied only after the lease is signed
    // (unit.status was already set to 'reserved' during account creation)

    // Record two separate payments: deposit + first month rent
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    await Promise.all([
      Payment.create({
        tenantId: lease.tenantId,
        leaseId: lease._id,
        unitId: lease.unitId,
        stripePaymentIntentId: confirmedIntentId!,
        amount: unit.price,
        currency: 'usd',
        type: 'deposit',
        status: 'succeeded',
        periodStart,
        periodEnd,
        attemptCount: 1,
      }),
      Payment.create({
        tenantId: lease.tenantId,
        leaseId: lease._id,
        unitId: lease.unitId,
        stripePaymentIntentId: `${confirmedIntentId!}_rent`,
        amount: unit.price,
        currency: 'usd',
        type: 'rent',
        status: 'succeeded',
        periodStart,
        periodEnd,
        attemptCount: 1,
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
