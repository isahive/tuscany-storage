import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'

const schema = z.object({
  unitId: z.string().min(1),
  /** Optional patch of tenant contact/personal info — admin allowed the
   *  reserve page to edit pre-filled fields before submit. */
  patch: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    alternateContactName: z.string().optional(),
    alternatePhone: z.string().optional(),
    alternateEmail: z.string().optional(),
    alternateAddress: z.string().optional(),
    alternateCity: z.string().optional(),
    alternateState: z.string().optional(),
    alternateZip: z.string().optional(),
    ssn: z.string().optional(),
    employerName: z.string().optional(),
    employerPhone: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().optional(),
    securityQuestion: z.string().optional(),
    securityAnswer: z.string().optional(),
    smsConsent: z.boolean().optional(),
  }).partial().optional(),
})

/**
 * POST /api/portal/reserve
 *
 * Tenant-aware sibling of /api/public/reserve. Skips account creation —
 * the user is already signed in. Steps:
 *   1. Patch any contact/personal info the tenant changed in step 1
 *   2. Create the Lease in 'active' status
 *   3. Mark the Unit as 'reserved' and link tenant/lease
 *   4. Create an UN-confirmed Stripe PaymentIntent (deposit + first month)
 *      and return client_secret for client-side `confirmCardPayment`
 *
 * Note: agreement signing + payment finalization still happen at
 * /api/public/reserve/finalize (same flow as new users).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }

    const { unitId, patch } = parsed.data

    await connectDB()

    const tenant = await Tenant.findById(session.user.id).select('+stripeCustomerId')
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const unit = await Unit.findById(unitId)
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    if (unit.status !== 'available') {
      return NextResponse.json({ success: false, error: 'This unit is no longer available.' }, { status: 409 })
    }

    // ── 1. Patch tenant fields ──
    if (patch && Object.keys(patch).length > 0) {
      Object.assign(tenant, patch)
      if (typeof patch.smsConsent === 'boolean') {
        tenant.smsOptIn = patch.smsConsent
      }
    }

    // ── 2. Create the lease ──
    const today = new Date()
    const billingDay = Math.min(today.getDate(), 28)
    const lease = await Lease.create({
      tenantId: tenant._id,
      unitId: unit._id,
      startDate: today,
      monthlyRate: unit.price,
      deposit: unit.price,
      proratedFirstMonth: 0,
      billingDay,
      status: 'active',
    })

    // ── 3. Reserve the unit ──
    unit.status = 'reserved'
    unit.currentLeaseId = lease._id
    unit.currentTenantId = tenant._id
    await unit.save()

    // ── 4. PaymentIntent ──
    const totalAmount = unit.price * 2 // deposit + first month
    let clientSecret: string | null = null

    if (process.env.STRIPE_SECRET_KEY) {
      const { stripe } = await import('@/lib/stripe')

      // Ensure Stripe customer exists (existing tenants from CSV imports may
      // not have one yet).
      if (!tenant.stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: tenant.email,
          name: `${tenant.firstName} ${tenant.lastName}`,
          phone: tenant.phone,
          metadata: { tenantId: String(tenant._id) },
        })
        tenant.stripeCustomerId = customer.id
      }

      const intent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd',
        customer: tenant.stripeCustomerId,
        payment_method_types: ['card'],
        setup_future_usage: 'off_session',
        metadata: {
          tenantId: String(tenant._id),
          leaseId: String(lease._id),
          unitId: String(unit._id),
          flow: 'portal-reserve',
        },
      }, {
        idempotencyKey: `portal-reserve-${unit._id}-${tenant._id}-${Date.now()}`,
      })
      clientSecret = intent.client_secret
    }

    await tenant.save()

    return NextResponse.json({
      success: true,
      data: {
        leaseId: String(lease._id),
        clientSecret,
        devMode: !process.env.STRIPE_SECRET_KEY,
        totalAmount,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
