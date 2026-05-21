import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import MoveOutRequest from '@/models/MoveOutRequest'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Payment from '@/models/Payment'
import { sendTemplatedNotification } from '@/lib/sendNotification'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/move-out/[id]/receipt/text
// Renders the admin-configurable "Move Out Receipt" template and dispatches
// the SMS channel only via Twilio. Honors the template's textContent body —
// admins can customize at /admin/communications/templates.
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const request = await MoveOutRequest.findById(id)
    if (!request) {
      return NextResponse.json({ success: false, error: 'Move-out request not found' }, { status: 404 })
    }

    const [tenant, unit] = await Promise.all([
      Tenant.findById(request.tenantId),
      Unit.findById(request.unitId).select('unitNumber size').lean() as Promise<{ unitNumber?: string; size?: string } | null>,
    ])
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }
    if (!tenant.phone) {
      return NextResponse.json({ success: false, error: 'Tenant has no phone on file' }, { status: 400 })
    }

    const totals = await Payment.aggregate([
      { $match: { tenantId: request.tenantId, status: { $in: ['pending', 'failed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    const balance = totals[0]?.total ?? 0

    await sendTemplatedNotification({
      templateName: 'Move Out Receipt',
      notificationType: 'move_out_confirmation',
      channels: 'sms',
      tenant,
      unitNumber: unit?.unitNumber,
      unitSize: unit?.size,
      balance,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
