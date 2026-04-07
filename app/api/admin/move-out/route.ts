import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import AccessLog from '@/models/AccessLog'

const moveOutSchema = z.object({
  leaseId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = moveOutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    // Step 1: Find lease and update
    const lease = await Lease.findById(parsed.data.leaseId)
    if (!lease) {
      return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })
    }

    lease.status = 'ended'
    lease.endDate = new Date()
    await lease.save()

    // Step 2: Update unit
    await Unit.findByIdAndUpdate(lease.unitId, {
      status: 'available',
      $unset: { currentTenantId: 1, currentLeaseId: 1 },
    })

    // Step 3: Update tenant status
    await Tenant.findByIdAndUpdate(lease.tenantId, {
      status: 'moved_out',
      $unset: { gateCode: 1 },
    })

    // Step 4 & 5: Revoke gate code and create AccessLog
    await AccessLog.create({
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      eventType: 'code_changed',
      gateId: 'entrance',
      source: 'admin',
      notes: 'Gate code revoked during move-out',
    })

    // Fetch updated documents
    const [updatedLease, updatedTenant, updatedUnit] = await Promise.all([
      Lease.findById(lease._id),
      Tenant.findById(lease.tenantId),
      Unit.findById(lease.unitId),
    ])

    return NextResponse.json({
      success: true,
      data: {
        lease: updatedLease,
        tenant: updatedTenant,
        unit: updatedUnit,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
