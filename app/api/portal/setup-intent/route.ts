import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

// POST /api/portal/setup-intent
// Creates a Stripe SetupIntent so the customer can save a new payment method.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { success: false, error: 'Stripe is not configured in this environment.' },
        { status: 503 },
      )
    }

    await connectDB()

    const tenant = await Tenant.findById(session.user.id).select('+stripeCustomerId')
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const { stripe } = await import('@/lib/stripe')

    // Ensure Stripe customer exists
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

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    })

    return NextResponse.json({ success: true, clientSecret: setupIntent.client_secret })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
