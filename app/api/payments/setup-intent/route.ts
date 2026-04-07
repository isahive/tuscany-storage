import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const tenant = await Tenant.findById(session.user.id)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      // Mock for dev
      return NextResponse.json({
        success: true,
        data: {
          clientSecret: `seti_mock_secret_${Date.now()}`,
          customerId: tenant.stripeCustomerId || `cus_mock_${Date.now()}`,
        },
      })
    }

    const { stripe } = await import('@/lib/stripe')

    // Create Stripe Customer if doesn't exist
    if (!tenant.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        name: `${tenant.firstName} ${tenant.lastName}`,
        phone: tenant.phone,
        metadata: { tenantId: tenant._id.toString() },
      })
      tenant.stripeCustomerId = customer.id
      await tenant.save()
    }

    // Create SetupIntent — this lets the frontend collect card info
    // without charging. The card gets saved to the customer.
    const setupIntent = await stripe.setupIntents.create({
      customer: tenant.stripeCustomerId,
      payment_method_types: ['card'],
      metadata: { tenantId: tenant._id.toString() },
    })

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: setupIntent.client_secret,
        customerId: tenant.stripeCustomerId,
      },
    })
  } catch (error) {
    console.error('[POST /api/payments/setup-intent]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
