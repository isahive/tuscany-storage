import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

interface RouteContext {
  params: Promise<{ id: string; pmId: string }>
}

/**
 * PATCH /api/admin/tenants/[id]/payment-methods/[pmId]
 * Body: { setDefault?: boolean }
 * Updates this PM (e.g. promote to default).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    const { id, pmId } = await context.params
    const body = await req.json().catch(() => ({}))

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 })
    }

    await connectDB()
    const tenant = await Tenant.findById(id).select('+stripeCustomerId +defaultPaymentMethodId')
    if (!tenant || !tenant.stripeCustomerId) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const { stripe } = await import('@/lib/stripe')

    if (body.setDefault) {
      await stripe.customers.update(tenant.stripeCustomerId, {
        invoice_settings: { default_payment_method: pmId },
      })
      tenant.defaultPaymentMethodId = pmId
      await tenant.save()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/tenants/[id]/payment-methods/[pmId]
 * Detaches the PM from the customer. Clears defaultPaymentMethodId if it was the default.
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    const { id, pmId } = await context.params

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 })
    }

    await connectDB()
    const tenant = await Tenant.findById(id).select('+stripeCustomerId +defaultPaymentMethodId')
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const { stripe } = await import('@/lib/stripe')
    await stripe.paymentMethods.detach(pmId)

    if (tenant.defaultPaymentMethodId === pmId) {
      tenant.defaultPaymentMethodId = undefined
      await tenant.save()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
