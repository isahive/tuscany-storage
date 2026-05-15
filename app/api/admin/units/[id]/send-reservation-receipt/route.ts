import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Tenant from '@/models/Tenant'
import { sendTemplatedNotification } from '@/lib/sendNotification'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/units/[id]/send-reservation-receipt
 * Admin-only manual trigger for the "Reservation Receipt" template — fires
 * when an admin is viewing an active reservation and wants to re-send the
 * confirmation. Auto-trigger lives in /api/admin/tenants/[id]/reserve-unit.
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const unit = await Unit.findById(id).lean() as any
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    if (unit.status !== 'reserved' || !unit.reservedTenantId) {
      return NextResponse.json({ success: false, error: 'No active reservation on this unit' }, { status: 400 })
    }

    const tenant = await Tenant.findById(unit.reservedTenantId)
    if (!tenant) return NextResponse.json({ success: false, error: 'Reserved tenant not found' }, { status: 404 })

    await sendTemplatedNotification({
      templateName: 'Reservation Receipt',
      notificationType: 'custom',
      tenant: tenant as any,
      unitNumber: unit.unitNumber,
      unitSize: unit.size,
      monthlyRate: unit.reservedPrice ?? unit.price,
      dueDate: unit.reservedMoveInDate,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
