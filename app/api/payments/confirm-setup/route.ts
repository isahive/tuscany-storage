import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

const confirmSchema = z.object({
  paymentMethodId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const tenant = await Tenant.findById(session.user.id)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    if (process.env.STRIPE_SECRET_KEY && tenant.stripeCustomerId) {
      const { stripe } = await import('@/lib/stripe')

      // Set this as the default payment method on the Stripe Customer
      await stripe.customers.update(tenant.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: parsed.data.paymentMethodId,
        },
      })

      // Get card details for display (last4, brand)
      const pm = await stripe.paymentMethods.retrieve(parsed.data.paymentMethodId)

      // Update tenant with new default payment method
      tenant.defaultPaymentMethodId = parsed.data.paymentMethodId
      await tenant.save()

      return NextResponse.json({
        success: true,
        data: {
          paymentMethodId: parsed.data.paymentMethodId,
          card: pm.card ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          } : null,
        },
      })
    }

    // Dev mode — just save the ID
    tenant.defaultPaymentMethodId = parsed.data.paymentMethodId
    await tenant.save()

    return NextResponse.json({
      success: true,
      data: {
        paymentMethodId: parsed.data.paymentMethodId,
        card: null,
      },
    })
  } catch (error) {
    console.error('[POST /api/payments/confirm-setup]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
