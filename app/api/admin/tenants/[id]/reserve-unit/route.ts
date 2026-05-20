import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Settings from '@/models/Settings'
import { sendTemplatedNotification } from '@/lib/sendNotification'
import { feeForUnitType } from '@/lib/reservationFee'

interface RouteContext {
  params: Promise<{ id: string }>
}

const schema = z.object({
  unitId: z.string().min(1),
  /** Cents — the price the admin shows the tenant. Defaults from
   *  Settings.unitTypeReservationFees when omitted. */
  reservationPrice: z.number().int().min(0).optional(),
  desiredMoveInDate: z.string().min(1),         // YYYY-MM-DD
  /** When true, charges the fee off-session via the tenant's saved card.
   *  When false (default), records the intended fee but skips Stripe — the
   *  admin will collect by check/cash or charge later. */
  chargeNow: z.boolean().optional(),
})

/** YYYY-MM-DD → UTC midnight Date so server TZ doesn't drift the calendar day. */
function parseCalendarDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`)
  return new Date(s)
}

/**
 * POST /api/admin/tenants/[id]/reserve-unit
 *
 * Marks a Unit as `reserved` for a specific tenant, stamping the reservation
 * price and desired move-in date. No payment is taken at reservation time —
 * the tenant pays at move-in via the rent-unit flow.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id: tenantId } = await context.params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    await connectDB()

    const [tenant, unit] = await Promise.all([
      Tenant.findById(tenantId),
      Unit.findById(parsed.data.unitId),
    ])
    if (!tenant) return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    if (unit.status !== 'available') {
      return NextResponse.json({ success: false, error: 'Unit is not available' }, { status: 400 })
    }

    // Default the reservation price from Settings when admin didn't override.
    const settings = await Settings.findOne({}).lean<{ unitTypeReservationFees?: Array<{ unitType: string; amount: number }> }>()
    const defaultFee = feeForUnitType(unit.type, settings?.unitTypeReservationFees)
    const reservationPrice = parsed.data.reservationPrice ?? defaultFee

    unit.status = 'reserved'
    unit.reservedTenantId = tenant._id
    unit.reservedAt = new Date()
    unit.reservedMoveInDate = parseCalendarDate(parsed.data.desiredMoveInDate)
    unit.reservedPrice = reservationPrice

    // ── Optional: capture the reservation fee via Stripe now ──
    if (parsed.data.chargeNow && reservationPrice > 0 && process.env.STRIPE_SECRET_KEY) {
      if (!(tenant as any).defaultPaymentMethodId || !tenant.stripeCustomerId) {
        return NextResponse.json(
          { success: false, error: 'Tenant has no saved payment method — collect the fee manually or save a card first.' },
          { status: 422 },
        )
      }
      try {
        const { stripe } = await import('@/lib/stripe')
        const intent = await stripe.paymentIntents.create({
          amount: reservationPrice,
          currency: 'usd',
          customer: tenant.stripeCustomerId!,
          payment_method: (tenant as any).defaultPaymentMethodId,
          off_session: true,
          confirm: true,
          metadata: {
            tenantId: String(tenant._id),
            unitId: String(unit._id),
            kind: 'reservation_fee',
          },
        })
        unit.reservationPaymentIntentId = intent.id
        unit.reservationFeePaid = reservationPrice
        unit.reservationFeePaidAt = new Date()
      } catch (stripeErr) {
        const msg = stripeErr instanceof Error ? stripeErr.message : 'Stripe charge failed'
        return NextResponse.json({ success: false, error: msg }, { status: 402 })
      }
    }

    await unit.save()

    await sendTemplatedNotification({
      templateName: 'Reservation Receipt',
      notificationType: 'custom',
      tenant: tenant as any,
      unitNumber: unit.unitNumber,
      unitSize: unit.size,
      monthlyRate: reservationPrice,
      dueDate: unit.reservedMoveInDate,
    })

    return NextResponse.json({
      success: true,
      data: {
        unitId: String(unit._id),
        reservedFor: `${tenant.firstName} ${tenant.lastName}`.trim(),
        moveInDate: unit.reservedMoveInDate,
        reservedPrice: unit.reservedPrice,
        reservationFeePaid: unit.reservationFeePaid ?? 0,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
