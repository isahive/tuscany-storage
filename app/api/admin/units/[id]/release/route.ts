import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/units/[id]/release
 *
 * Frees a unit from whatever state it's in (reserved, occupied, maintenance):
 *   - Sets `status = 'available'`
 *   - Unsets `currentTenantId` and `currentLeaseId`
 *   - Ends any active or pending-moveout lease attached to this unit so the
 *     tenant ledger is clean
 *
 * The dashboard's plain PATCH endpoint accepts a status change but doesn't
 * touch the cross-references, which left orphan currentTenantId/currentLeaseId
 * pointers — the user couldn't actually re-rent the unit after release.
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const unit = await Unit.findById(id)
    if (!unit) {
      return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    }

    // End any open leases on the unit. Move-out finalize would normally do
    // this, but the admin is bypassing the move-out flow here.
    const now = new Date()
    await Lease.updateMany(
      { unitId: unit._id, status: { $in: ['active', 'pending_moveout'] } },
      { $set: { status: 'ended', endDate: now, moveOutDate: now } },
    )

    await Unit.findByIdAndUpdate(unit._id, {
      status: 'available',
      $unset: { currentTenantId: '', currentLeaseId: '' },
      ...(session.user.name || session.user.email
        ? { updatedByName: session.user.name ?? session.user.email }
        : {}),
    })

    return NextResponse.json({ success: true, data: { released: true } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
