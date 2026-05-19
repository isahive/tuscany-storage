import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Payment from '@/models/Payment'

/**
 * GET /api/portal/statement
 *
 * Backs the tenant-facing Statement screen ("Make a Payment" entry point).
 * Returns:
 *   - lineItems: pending charge rows (oldest first — same display order as the
 *     live Storable Easy portal)
 *   - units: active units the tenant can prepay against
 *   - credit / outstanding / total summary numbers
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const tenant = await Tenant.findById(session.user.id).lean() as any
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const leases = await Lease.find({
      tenantId: session.user.id,
      status: { $in: ['active', 'pending_moveout'] },
    }).populate('unitId').lean() as any[]

    const units = leases
      .map((l) => l.unitId)
      .filter(Boolean)
      .map((u: any) => ({
        unitId: u._id.toString(),
        unitNumber: u.unitNumber,
        size: u.size ?? '',
      }))

    const items = await Payment.find({
      tenantId: session.user.id,
      status: 'pending',
      direction: 'charge',
      type: { $in: ['rent', 'late_fee', 'deposit', 'prorated', 'other'] },
    }).populate('unitId', 'unitNumber').sort({ createdAt: 1 }).lean() as any[]

    const lineItems = items.map((p) => {
      const tax = Math.round(p.amount * ((p.taxRate ?? 0) / 100))
      return {
        id: p._id.toString(),
        dateCreated: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
        type: p.type,
        description: p.description ?? '',
        amount: p.amount,
        tax,
        due: p.amount + tax,
        unitNumber: p.unitId?.unitNumber ?? null,
        dueDate: p.dueDate ? new Date(p.dueDate).toISOString() : null,
        periodStart: p.periodStart ? new Date(p.periodStart).toISOString() : null,
        periodEnd: p.periodEnd ? new Date(p.periodEnd).toISOString() : null,
      }
    })

    const balance = tenant.balance ?? 0
    const credit = balance < 0 ? -balance : 0
    const outstandingCharges = lineItems.reduce((sum, i) => sum + i.due, 0)
    const total = Math.max(0, outstandingCharges - credit)

    return NextResponse.json({
      success: true,
      data: {
        lineItems,
        units,
        credit,
        outstanding: outstandingCharges,
        total,
        balance,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
