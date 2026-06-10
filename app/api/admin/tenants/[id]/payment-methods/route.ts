import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/tenants/[id]/payment-methods
 * Lists saved cards on the tenant's Stripe customer. Returns the default first.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const tenant = await Tenant.findById(id).select('+stripeCustomerId +defaultPaymentMethodId')
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    if (!process.env.STRIPE_SECRET_KEY || !tenant.stripeCustomerId) {
      return NextResponse.json({
        success: true,
        data: {
          paymentMethods: [],
          defaultPaymentMethodId: tenant.defaultPaymentMethodId ?? null,
          autopayEnabled: tenant.autopayEnabled,
          billingDateOffset: tenant.billingDateOffset ?? 0,
        },
      })
    }

    const { stripe } = await import('@/lib/stripe')

    const list = await stripe.paymentMethods.list({
      customer: tenant.stripeCustomerId,
      type: 'card',
    })

    const paymentMethods = list.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? '',
      last4: pm.card?.last4 ?? '',
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
      isDefault: pm.id === tenant.defaultPaymentMethodId,
    }))

    // Put default first
    paymentMethods.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))

    return NextResponse.json({
      success: true,
      data: {
        paymentMethods,
        defaultPaymentMethodId: tenant.defaultPaymentMethodId ?? null,
        autopayEnabled: tenant.autopayEnabled,
        billingDateOffset: tenant.billingDateOffset ?? 0,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * POST /api/admin/tenants/[id]/payment-methods
 * Body: { paymentMethodId, setDefault?: boolean }
 * Attaches a PM (created via SetupIntent on the frontend) to the tenant.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const paymentMethodId = body.paymentMethodId as string | undefined
    const setDefault = body.setDefault !== false

    if (!paymentMethodId) {
      return NextResponse.json({ success: false, error: 'Missing paymentMethodId' }, { status: 400 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 })
    }

    await connectDB()
    const tenant = await Tenant.findById(id).select('+stripeCustomerId +defaultPaymentMethodId')
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const { stripe } = await import('@/lib/stripe')

    // Ensure tenant has a Stripe customer
    if (!tenant.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        name: `${tenant.firstName} ${tenant.lastName}`,
        phone: tenant.phone,
        metadata: { tenantId: tenant._id.toString() },
      })
      tenant.stripeCustomerId = customer.id
    }

    // Attach if not yet attached
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
    if (!pm.customer) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: tenant.stripeCustomerId })
    }

    if (setDefault) {
      await stripe.customers.update(tenant.stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      })
      tenant.defaultPaymentMethodId = paymentMethodId
    }

    await tenant.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
