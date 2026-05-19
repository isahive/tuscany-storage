import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Promotion from '@/models/Promotion'
import TenantAlteration from '@/models/TenantAlteration'

// POST /api/admin/leases/[id]/remove-promotion
// Storable: only managers/sales remove a promo, never the tenant.
// Does NOT clear `appliedCount` on the promotion — Storable tracks total times
// applied historically, not the active count.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const lease = await Lease.findById(params.id)
    if (!lease) return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })
    if (!lease.appliedPromotionId) {
      return NextResponse.json({ success: false, error: 'No promotion on this rental.' }, { status: 409 })
    }

    const promo = await Promotion.findById(lease.appliedPromotionId)
    const unit = await Unit.findById(lease.unitId).select('unitNumber')

    lease.appliedPromotionId = undefined
    await lease.save()

    await TenantAlteration.create({
      tenantId: lease.tenantId,
      leaseId: lease._id,
      unitId: lease.unitId,
      unitNumber: unit?.unitNumber,
      action: 'promotion_removed',
      payload: promo
        ? {
            promotionId: String(promo._id),
            promotionName: promo.name,
            method: promo.method,
          }
        : { promotionId: String(lease.appliedPromotionId) },
      createdBy: session.user.name ?? session.user.email ?? 'admin',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
