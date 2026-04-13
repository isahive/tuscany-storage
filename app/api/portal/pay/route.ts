import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'

const schema = z.object({
  amount: z.number().int().positive(),          // cents
  type: z.enum(['rent', 'late_fee', 'deposit', 'prorated', 'other']).default('rent'),
  paymentMethodId: z.string().optional(),       // use specific PM; falls back to default
  note: z.string().optional(),
})

// POST /api/portal/pay
// Tenant pays their own balance on-session.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const { amount, type, paymentMethodId, note } = parsed.data

    await connectDB()

    const [tenant, lease] = await Promise.all([
      Tenant.findById(session.user.id).select('+stripeCustomerId +defaultPaymentMethodId'),
      Lease.findOne({ tenantId: session.user.id, status: 'active' }),
    ])

    if (!tenant) return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    if (!lease)  return NextResponse.json({ success: false, error: 'No active lease found' }, { status: 404 })

    const pmId = paymentMethodId ?? tenant.defaultPaymentMethodId
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    let stripePaymentIntentId: string
    let paymentStatus: 'succeeded' | 'pending' | 'failed' = 'succeeded'

    if (!process.env.STRIPE_SECRET_KEY) {
      // Dev mode
      stripePaymentIntentId = `pi_mock_${crypto.randomBytes(12).toString('hex')}`
      console.log(`[DEV STRIPE] Mock tenant payment: ${stripePaymentIntentId} $${(amount / 100).toFixed(2)}`)
    } else {
      if (!pmId) {
        return NextResponse.json(
          { success: false, error: 'No payment method on file. Please add a card first.' },
          { status: 422 },
        )
      }

      const { stripe } = await import('@/lib/stripe')

      // Ensure customer exists
      let customerId = tenant.stripeCustomerId
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: tenant.email,
          name: `${tenant.firstName} ${tenant.lastName}`,
          metadata: { tenantId: tenant._id.toString() },
        })
        customerId = customer.id
        tenant.stripeCustomerId = customerId
        await tenant.save()
      }

      try {
        const intent = await stripe.paymentIntents.create({
          amount,
          currency: 'usd',
          customer: customerId,
          payment_method: pmId,
          payment_method_types: ['card'],
          off_session: false,
          confirm: true,
          metadata: {
            tenantId: session.user.id,
            leaseId: lease._id.toString(),
            type,
            note: note ?? '',
            selfPay: 'true',
          },
        }, {
          idempotencyKey: `portal-pay-${session.user.id}-${Date.now()}`,
        })
        stripePaymentIntentId = intent.id
        paymentStatus = intent.status === 'succeeded' ? 'succeeded' : 'pending'
      } catch (stripeErr: unknown) {
        const msg = stripeErr instanceof Error ? stripeErr.message : 'Payment failed'
        return NextResponse.json({ success: false, error: msg }, { status: 402 })
      }
    }

    const payment = await Payment.create({
      tenantId: session.user.id,
      leaseId: lease._id,
      unitId: lease.unitId,
      amount,
      currency: 'usd',
      type,
      status: paymentStatus,
      stripePaymentIntentId,
      periodStart,
      periodEnd,
      attemptCount: 1,
      ...(note ? { description: note } : {}),
    })

    return NextResponse.json({ success: true, data: payment }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
