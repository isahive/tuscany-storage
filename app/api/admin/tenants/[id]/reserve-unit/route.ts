import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'

interface RouteContext {
  params: Promise<{ id: string }>
}

const schema = z.object({
  unitId: z.string().min(1),
  reservationPrice: z.number().int().min(0),   // cents
  desiredMoveInDate: z.string().min(1),         // YYYY-MM-DD
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

    unit.status = 'reserved'
    unit.reservedTenantId = tenant._id
    unit.reservedAt = new Date()
    unit.reservedMoveInDate = parseCalendarDate(parsed.data.desiredMoveInDate)
    unit.reservedPrice = parsed.data.reservationPrice
    await unit.save()

    return NextResponse.json({
      success: true,
      data: {
        unitId: String(unit._id),
        reservedFor: `${tenant.firstName} ${tenant.lastName}`.trim(),
        moveInDate: unit.reservedMoveInDate,
        reservedPrice: unit.reservedPrice,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
