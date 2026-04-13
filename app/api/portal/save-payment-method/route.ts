import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

const schema = z.object({
  paymentMethodId: z.string().min(1),
  setDefault: z.boolean().optional().default(true),
})

// POST /api/portal/save-payment-method
// After a SetupIntent is confirmed, save the payment method ID on the tenant.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const { paymentMethodId } = parsed.data

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 })
    }

    await connectDB()

    const tenant = await Tenant.findById(session.user.id).select('+stripeCustomerId +defaultPaymentMethodId')
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const { stripe } = await import('@/lib/stripe')

    // Attach to customer if not already attached
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
    if (!pm.customer) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: tenant.stripeCustomerId! })
    }

    // Set as default on Stripe customer
    await stripe.customers.update(tenant.stripeCustomerId!, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    // Save on tenant
    tenant.defaultPaymentMethodId = paymentMethodId
    await tenant.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
