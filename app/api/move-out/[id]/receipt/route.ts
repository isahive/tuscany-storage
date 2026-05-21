import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import MoveOutRequest from '@/models/MoveOutRequest'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Payment from '@/models/Payment'
import { renderTemplate } from '@/lib/sendNotification'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/move-out/[id]/receipt
// Returns the rendered "Move Out Receipt" template (subject + email HTML + SMS
// body) plus tenant/facility metadata. The admin preview page mirrors the
// exact bytes that would be sent so customization at
// /admin/communications/templates is WYSIWYG.
export async function GET(_req: NextRequest, context: RouteContext) {
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

    const totals = await Payment.aggregate([
      { $match: { tenantId: request.tenantId, status: { $in: ['pending', 'failed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    const balance = totals[0]?.total ?? 0

    const rendered = await renderTemplate({
      templateName: 'Move Out Receipt',
      tenant,
      unitNumber: unit?.unitNumber,
      unitSize: unit?.size,
      balance,
    })

    return NextResponse.json({
      success: true,
      data: {
        tenant: {
          firstName: tenant.firstName,
          lastName:  tenant.lastName,
          email:     tenant.email,
          phone:     tenant.phone,
        },
        unitNumber: unit?.unitNumber ?? '',
        balance,
        template: rendered ?? null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
