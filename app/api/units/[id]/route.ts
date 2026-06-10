import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import MoveOutRequest from '@/models/MoveOutRequest'
import '@/models/Tenant'
import { computeDisplayStatus } from '@/lib/unitStatus'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    await connectDB()

    const unit = await Unit.findById(id)
      .populate('currentTenantId')
      .populate('currentLeaseId')
      .lean() as any

    if (!unit) {
      return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    }

    // Derive the live "display status" + the operational fields the unit
    // detail page renders (Next Bill, Customer Access lock state).
    const tenantId = unit.currentTenantId?._id
    const now = new Date()

    const [activeLease, oldestUnpaid, pendingMoveOut] = await Promise.all([
      Lease.findOne({ unitId: unit._id, status: { $in: ['active', 'pending_moveout'] } })
        .select('status auctionDate auctionScheduledAt billingDay monthlyRate startDate')
        .lean() as any,
      tenantId
        ? Payment.findOne({
            tenantId,
            type: 'rent',
            status: { $in: ['pending', 'failed'] },
          })
            .sort({ dueDate: 1, periodEnd: 1 })
            .select('dueDate periodEnd')
            .lean() as any
        : Promise.resolve(null),
      MoveOutRequest.findOne({ unitId: unit._id, status: 'pending' }).select('_id').lean(),
    ])

    const displayStatus = computeDisplayStatus({
      unitStatus: unit.status,
      lease: activeLease
        ? {
            status: activeLease.status,
            auctionDate: activeLease.auctionDate ?? null,
            auctionScheduledAt: activeLease.auctionScheduledAt ?? null,
          }
        : null,
      tenant: unit.currentTenantId ? { status: unit.currentTenantId.status } : null,
      oldestUnpaid: oldestUnpaid
        ? { dueDate: oldestUnpaid.dueDate, periodEnd: oldestUnpaid.periodEnd }
        : null,
      hasPendingMoveOutRequest: !!pendingMoveOut,
      now,
    })

    // Next bill = next occurrence of the lease's billingDay (today or later).
    let nextBillDate: Date | null = null
    if (activeLease?.billingDay) {
      const candidate = new Date(now.getFullYear(), now.getMonth(), activeLease.billingDay)
      if (candidate < now) candidate.setMonth(candidate.getMonth() + 1)
      nextBillDate = candidate
    }

    return NextResponse.json({
      success: true,
      data: {
        ...unit,
        displayStatus,
        nextBillDate,
        leaseStartDate: activeLease?.startDate ?? null,
        leaseMonthlyRate: activeLease?.monthlyRate ?? null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

const updateUnitSchema = z.object({
  unitNumber: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  width: z.number().positive().optional(),
  depth: z.number().positive().optional(),
  type: z.enum(['standard', 'climate_controlled', 'drive_up', 'vehicle_outdoor']).optional(),
  price: z.number().int().positive().optional(),
  status: z.enum(['available', 'occupied', 'maintenance', 'reserved']).optional(),
  features: z.array(z.string()).optional(),
  notes: z.string().optional(),
  gridX: z.number().int().min(0).optional(),
  gridY: z.number().int().min(0).optional(),
  gridFloor: z.number().int().min(1).optional(),
  pricingOptions: z
    .array(z.object({ amount: z.number().int().min(0), intervalMonths: z.number().int().min(1) }))
    .optional(),
  defaultDeposit: z.number().int().min(0).optional(),
  defaultSetupFee: z.number().int().min(0).optional(),
  reservationPrice: z.number().int().min(0).optional(),
})

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const parsed = updateUnitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    // Recalculate sqft if width or depth changed
    const updateData: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.width || parsed.data.depth) {
      const existing = await Unit.findById(id)
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
      }
      const width = parsed.data.width ?? existing.width
      const depth = parsed.data.depth ?? existing.depth
      updateData.sqft = width * depth
    }

    // Record who edited so the unit detail page can show "Updated … by …".
    if (session.user.name) updateData.updatedByName = session.user.name
    else if (session.user.email) updateData.updatedByName = session.user.email

    const unit = await Unit.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
    if (!unit) {
      return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: unit })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
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

    if (unit.status !== 'available') {
      return NextResponse.json(
        { success: false, error: 'Can only delete units with available status' },
        { status: 400 }
      )
    }

    await Unit.findByIdAndDelete(id)

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
