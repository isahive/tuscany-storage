import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'

const chargeSchema = z.object({
  tenantId: z.string().min(1),
  leaseId: z.string().min(1),
  amount: z.number().positive(), // dollars (e.g. 125.00)
  type: z.enum(['rent', 'late_fee', 'deposit', 'prorated', 'other']),
  note: z.string().optional(),
})

// POST /api/payments/admin-charge
// Admin charges a tenant's saved payment method off-session
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = chargeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const { tenantId, leaseId, amount, type, note } = parsed.data
    const amountCents = Math.round(amount * 100)

    await connectDB()

    const [tenant, lease] = await Promise.all([
      Tenant.findById(tenantId).select('+stripeCustomerId +defaultPaymentMethodId'),
      Lease.findById(leaseId),
    ])

    if (!tenant) return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    if (!lease)  return NextResponse.json({ success: false, error: 'Lease not found' },  { status: 404 })

    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    let stripePaymentIntentId: string
    let paymentStatus: 'succeeded' | 'pending' | 'failed' = 'succeeded'

    if (!process.env.STRIPE_SECRET_KEY) {
      // Dev mode — create a mock payment intent ID
      stripePaymentIntentId = `pi_mock_${crypto.randomBytes(12).toString('hex')}`
      console.log(`[DEV STRIPE] Mock admin charge: ${stripePaymentIntentId} $${amount} for tenant ${tenantId}`)
    } else {
      const { stripe } = await import('@/lib/stripe')

      if (!tenant.defaultPaymentMethodId) {
        return NextResponse.json(
          { success: false, error: 'Tenant has no saved payment method on file.' },
          { status: 422 },
        )
      }

      try {
        const intent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: 'usd',
          customer: tenant.stripeCustomerId!,
          payment_method: tenant.defaultPaymentMethodId,
          off_session: true,
          confirm: true,
          metadata: {
            tenantId,
            leaseId,
            type,
            note: note ?? '',
            chargedBy: session.user.id,
          },
        })

        stripePaymentIntentId = intent.id
        paymentStatus = intent.status === 'succeeded' ? 'succeeded' : 'pending'
      } catch (stripeErr: unknown) {
        const msg = stripeErr instanceof Error ? stripeErr.message : 'Stripe charge failed'
        return NextResponse.json({ success: false, error: msg }, { status: 402 })
      }
    }

    const payment = await Payment.create({
      tenantId,
      leaseId,
      unitId: lease.unitId,
      amount: amountCents,
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
