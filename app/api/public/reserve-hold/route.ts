import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Settings from '@/models/Settings'
import { feeForUnitType } from '@/lib/reservationFee'
import { sendTemplatedNotification } from '@/lib/sendNotification'

/**
 * Public reservation-hold endpoint. Distinct from /api/public/reserve which
 * is the full move-in path — this one just HOLDS a unit and captures the
 * per-unit-type fee. When the customer later converts the reservation to a
 * rental, the rent-unit flow credits the prepaid fee on the first invoice
 * (see app/api/admin/tenants/[id]/rent-unit/route.ts).
 *
 * Two stages:
 *   1. PaymentIntent created (no DB writes) — returned to the browser so it
 *      can mount Stripe Elements and collect the card.
 *   2. After client-side confirm, the browser POSTs again with `confirmedI
 *      ntentId` and we create the tenant + reserve the unit.
 */

const schema = z.object({
  unitId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  desiredMoveInDate: z.string().optional(),
  // Stage 2: PaymentIntent that the browser already confirmed via Stripe Elements.
  confirmedIntentId: z.string().optional(),
})

function parseCalendarDate(s?: string): Date | undefined {
  if (!s) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`)
  return new Date(s)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Please fill in all required fields.' }, { status: 400 })
    }

    await connectDB()
    const unit = await Unit.findById(parsed.data.unitId)
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    if (unit.status !== 'available') {
      return NextResponse.json({ success: false, error: 'This unit is no longer available.' }, { status: 409 })
    }

    const settings = await Settings.findOne({}).lean<{
      enableReservations?: boolean
      unitTypeReservationFees?: Array<{ unitType: string; amount: number }>
    }>()

    if (settings?.enableReservations === false) {
      return NextResponse.json({ success: false, error: 'Online reservations are disabled.' }, { status: 403 })
    }

    const fee = feeForUnitType(unit.type, settings?.unitTypeReservationFees)
    if (fee <= 0) {
      return NextResponse.json(
        { success: false, error: 'This unit type does not have a reservation fee configured.' },
        { status: 400 },
      )
    }

    // ── Stage 1 — create a PaymentIntent and return the client_secret ──
    if (!parsed.data.confirmedIntentId) {
      if (!process.env.STRIPE_SECRET_KEY) {
        // Dev mode — no real Stripe; pretend the intent is ready and let the
        // client skip confirmation.
        return NextResponse.json({
          success: true,
          data: { clientSecret: null, devMode: true, amount: fee },
        })
      }
      const { stripe } = await import('@/lib/stripe')
      const intent = await stripe.paymentIntents.create({
        amount: fee,
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          unitId: String(unit._id),
          kind: 'reservation_fee',
        },
      })
      return NextResponse.json({
        success: true,
        data: { clientSecret: intent.client_secret, amount: fee, devMode: false },
      })
    }

    // ── Stage 2 — frontend confirmed the intent; finalize the hold ──
    const existing = await Tenant.findOne({ email: parsed.data.email.toLowerCase() })
    let tenant = existing
    if (!tenant) {
      // Create a "lite" tenant — random password they'll set when they later
      // convert the reservation to a real rental. login is disabled until then.
      const tempPassword = await bcrypt.hash(`tmp-${Date.now()}`, 12)
      tenant = await Tenant.create({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        password: tempPassword,
        loginDisabled: true,
        role: 'tenant',
        status: 'active',
      })
    }

    unit.status = 'reserved'
    unit.reservedTenantId = tenant._id
    unit.reservedAt = new Date()
    unit.reservedMoveInDate = parseCalendarDate(parsed.data.desiredMoveInDate)
    unit.reservedPrice = fee
    unit.reservationPaymentIntentId = parsed.data.confirmedIntentId
    unit.reservationFeePaid = fee
    unit.reservationFeePaidAt = new Date()
    await unit.save()

    await sendTemplatedNotification({
      templateName: 'Reservation Receipt',
      notificationType: 'custom',
      tenant: tenant as any,
      unitNumber: unit.unitNumber,
      unitSize: unit.size,
      monthlyRate: fee,
      dueDate: unit.reservedMoveInDate,
    })

    return NextResponse.json({
      success: true,
      data: {
        tenantId: String(tenant._id),
        unitId: String(unit._id),
        amount: fee,
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
