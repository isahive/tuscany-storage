import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Types } from 'mongoose'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Payment from '@/models/Payment'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

/**
 * GET /api/payments/[id]
 *
 * Returns a single Payment row alongside the tenant, unit and (if the row is
 * a payment with `appliedToItemIds`) the underlying charge rows it covered.
 *
 * Implementation note: we do *not* use Mongoose populate() here. Imported CSV
 * payments may reference tenants/units that don't exist in this environment,
 * and populate failures throw 500 which surfaced as a misleading
 * "Transaction not found". Manual lookups let us tolerate orphans.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ success: false, error: 'Invalid payment id' }, { status: 400 })
    }

    await connectDB()

    const payment = await Payment.findById(params.id).lean() as any
    if (!payment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 })
    }

    // Auth check: admin or the tenant who owns the row.
    const ownerId = payment.tenantId?.toString()
    if (session.user.role !== 'admin' && session.user.id !== ownerId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Tolerate missing tenant/unit (orphaned CSV imports).
    const [tenant, unit] = await Promise.all([
      payment.tenantId ? Tenant.findById(payment.tenantId).select('firstName lastName email phone').lean() : null,
      payment.unitId ? Unit.findById(payment.unitId).select('unitNumber size').lean() : null,
    ]) as [any, any]

    let appliedToItems: any[] = []
    if (Array.isArray(payment.appliedToItemIds) && payment.appliedToItemIds.length > 0) {
      const items = await Payment.find({ _id: { $in: payment.appliedToItemIds } })
        .select('amount type description status periodStart periodEnd dueDate unitId')
        .lean() as any[]
      // Attach unit numbers separately so a missing unit doesn't blow up.
      const unitIds = Array.from(new Set(items.map((i) => i.unitId?.toString()).filter(Boolean)))
      const units = unitIds.length > 0
        ? await Unit.find({ _id: { $in: unitIds } }).select('unitNumber').lean() as any[]
        : []
      const unitMap = new Map(units.map((u) => [u._id.toString(), u]))
      appliedToItems = items.map((i) => ({
        ...i,
        unitId: i.unitId ? unitMap.get(i.unitId.toString()) ?? null : null,
      }))
    }

    return NextResponse.json({
      success: true,
      data: {
        ...payment,
        tenantId: tenant ? { _id: payment.tenantId, ...tenant } : null,
        unitId: unit ? { _id: payment.unitId, ...unit } : null,
        appliedToItemIds: appliedToItems,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/payments/[id]
 *
 * Admin-only. Backs the Transaction Details "Update Transaction" button —
 * lets staff correct the visible Amount and/or Notes on an already-recorded
 * payment row. Does NOT touch tenant balance — refund/void handle that.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    if (!Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ success: false, error: 'Invalid payment id' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({})) as { amount?: number; notes?: string }

    await connectDB()
    const payment = await Payment.findById(params.id)
    if (!payment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 })
    }

    if (typeof body.notes === 'string') {
      payment.description = body.notes.trim() || payment.description
    }
    if (typeof body.amount === 'number' && Number.isFinite(body.amount) && body.amount > 0) {
      payment.amount = Math.round(body.amount * 100)
    }

    await payment.save()
    return NextResponse.json({ success: true, data: payment })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
