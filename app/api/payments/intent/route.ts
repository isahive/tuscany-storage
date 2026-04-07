import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'

const createIntentSchema = z.object({
  leaseId: z.string().min(1),
  amount: z.number().int().positive(),
  type: z.enum(['rent', 'late_fee', 'deposit', 'prorated', 'other']),
  saveCard: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = createIntentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const lease = await Lease.findById(parsed.data.leaseId)
    if (!lease) {
      return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })
    }

    // Ownership check: tenants can only create intents for their own leases
    if (session.user.role !== 'admin' && lease.tenantId.toString() !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      // Mock payment intent for development
      const mockId = `pi_mock_${crypto.randomBytes(12).toString('hex')}`
      const mockSecret = `${mockId}_secret_${crypto.randomBytes(12).toString('hex')}`

      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV STRIPE] Mock PaymentIntent created: ${mockId} for $${parsed.data.amount / 100}`)
      }

      return NextResponse.json({
        success: true,
        data: {
          clientSecret: mockSecret,
          paymentIntentId: mockId,
        },
      })
    }

    // Real Stripe integration
    const { stripe } = await import('@/lib/stripe')
    const Tenant = (await import('@/models/Tenant')).default

    const tenant = await Tenant.findById(lease.tenantId)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: parsed.data.amount,
      currency: 'usd',
      metadata: {
        leaseId: parsed.data.leaseId,
        tenantId: tenant._id.toString(),
        type: parsed.data.type,
      },
      ...(tenant.stripeCustomerId ? { customer: tenant.stripeCustomerId } : {}),
      ...(parsed.data.saveCard ? { setup_future_usage: 'off_session' as const } : {}),
    })

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
