import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

// GET /api/portal/billing-info
// Returns the tenant's payment method details and autopay status.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Session expired — please sign out and sign in again.' },
        { status: 401 },
      )
    }

    await connectDB()

    const tenant = await Tenant.findById(session.user.id)
      .select('+stripeCustomerId +defaultPaymentMethodId')
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found — please sign out and sign in again.' },
        { status: 404 },
      )
    }

    let paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null = null

    if (process.env.STRIPE_SECRET_KEY && tenant.stripeCustomerId && tenant.defaultPaymentMethodId) {
      try {
        const { stripe } = await import('@/lib/stripe')
        const pm = await stripe.paymentMethods.retrieve(tenant.defaultPaymentMethodId)
        if (pm.card) {
          paymentMethod = {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          }
        }
      } catch {
        // Stripe error — return without payment method info
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        autopayEnabled: tenant.autopayEnabled,
        paymentMethod,
        hasStripe: !!tenant.stripeCustomerId,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
