import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import { sendTemplatedNotification } from '@/lib/sendNotification'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/leases/[id]/send-agreement
 * Admin-only manual trigger for the "Storage Agreement" template — sent when
 * an admin is viewing a storage agreement and wants to email a copy to the
 * tenant. Never fires automatically.
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const lease = await Lease.findById(id).lean() as any
    if (!lease) return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })

    const [tenant, unit] = await Promise.all([
      Tenant.findById(lease.tenantId),
      Unit.findById(lease.unitId).lean() as any,
    ])
    if (!tenant) return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })

    await sendTemplatedNotification({
      templateName: 'Storage Agreement',
      notificationType: 'custom',
      tenant: tenant as any,
      unitNumber: unit?.unitNumber,
      unitSize: unit?.size,
      monthlyRate: lease.monthlyRate,
      deposit: lease.deposit,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
