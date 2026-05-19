import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Promotion from '@/models/Promotion'
import TenantAlteration from '@/models/TenantAlteration'
import { isPromotionAvailable, type PromotionLike } from '@/lib/promotions'

const schema = z.object({
  promotionId: z.string().min(1),
})

// POST /api/admin/leases/[id]/add-promotion
// Manager/sales path for attaching an existing promotion to a rental. Refuses
// when the lease already has an active promo (Storable: one promo per rental).
// Increments appliedCount + sets firstAppliedAt the first time it transitions
// and logs the change to TenantAlteration.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Missing promotionId' }, { status: 400 })
    }

    await connectDB()

    const lease = await Lease.findById(params.id)
    if (!lease) return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })
    if (lease.appliedPromotionId) {
      return NextResponse.json(
        { success: false, error: 'This rental already has an active promotion. Remove it first.' },
        { status: 409 },
      )
    }

    const promo = await Promotion.findById(parsed.data.promotionId)
    if (!promo) return NextResponse.json({ success: false, error: 'Promotion not found' }, { status: 404 })

    if (!isPromotionAvailable(promo as unknown as PromotionLike)) {
      return NextResponse.json({ success: false, error: 'Promotion is not currently available.' }, { status: 409 })
    }

    // Verify the unit type matches the promo scope.
    const unit = await Unit.findById(lease.unitId)
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    if (!promo.allUnitTypes && promo.unitTypes.length > 0 && !promo.unitTypes.includes(unit.type)) {
      return NextResponse.json(
        { success: false, error: `Promotion is not valid for ${unit.type} units.` },
        { status: 409 },
      )
    }

    lease.appliedPromotionId = promo._id
    await lease.save()

    if (!promo.firstAppliedAt) promo.firstAppliedAt = new Date()
    promo.appliedCount = (promo.appliedCount ?? 0) + 1
    await promo.save()

    await TenantAlteration.create({
      tenantId: lease.tenantId,
      leaseId: lease._id,
      unitId: lease.unitId,
      unitNumber: unit.unitNumber,
      action: 'promotion_added',
      payload: {
        promotionId: String(promo._id),
        promotionName: promo.name,
        method: promo.method,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
      },
      createdBy: session.user.name ?? session.user.email ?? 'admin',
    })

    return NextResponse.json({ success: true, data: { leaseId: String(lease._id), promotionId: String(promo._id) } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
