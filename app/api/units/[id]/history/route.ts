import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import '@/models/Tenant'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

const tenantName = (t: any): { id: string | null; name: string } => {
  if (t && typeof t === 'object' && t._id) {
    return { id: String(t._id), name: `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() || 'Unknown' }
  }
  return { id: null, name: 'Unknown' }
}

/**
 * GET /api/units/[id]/history
 * Admin-only. The unit's rental history (every lease) plus its payment
 * activity, newest first.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const unit = (await Unit.findById(id).select('unitNumber size type status').lean()) as any
    if (!unit) {
      return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    }

    const [leases, payments] = await Promise.all([
      Lease.find({ unitId: id })
        .populate('tenantId', 'firstName lastName')
        .sort({ startDate: -1 })
        .lean<Array<any>>(),
      Payment.find({ unitId: id })
        .populate('tenantId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean<Array<any>>(),
    ])

    const rentals = leases.map((l) => {
      const t = tenantName(l.tenantId)
      return {
        id: String(l._id),
        tenantId: t.id,
        tenantName: t.name,
        startDate: l.startDate,
        endDate: l.endDate ?? l.moveOutDate ?? null,
        monthlyRate: l.monthlyRate,
        status: l.status,
      }
    })

    const paymentRows = payments.map((p) => {
      const t = tenantName(p.tenantId)
      return {
        id: String(p._id),
        date: p.createdAt,
        tenantId: t.id,
        tenantName: t.name,
        type: p.type,
        direction: p.direction,
        amount: p.amount,
        status: p.status,
        description: p.description ?? '',
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        unit: { unitNumber: unit.unitNumber, size: unit.size, type: unit.type, status: unit.status },
        rentals,
        payments: paymentRows,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
