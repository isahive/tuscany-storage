import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/tenants/[id]/setup-intent
 * Creates a Stripe SetupIntent so the admin can collect & save a payment method
 * on behalf of the customer. Returns the client_secret for Elements.
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await context.params

    await connectDB()
    const tenant = await Tenant.findById(id).select('+stripeCustomerId')
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({
        success: true,
        data: {
          clientSecret: `seti_mock_secret_${Date.now()}`,
          customerId: tenant.stripeCustomerId || `cus_mock_${Date.now()}`,
          devMode: true,
        },
      })
    }

    const { stripe } = await import('@/lib/stripe')

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

    const setupIntent = await stripe.setupIntents.create({
      customer: tenant.stripeCustomerId,
      payment_method_types: ['card'],
      metadata: { tenantId: tenant._id.toString(), createdBy: 'admin' },
    })

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: setupIntent.client_secret,
        customerId: tenant.stripeCustomerId,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
