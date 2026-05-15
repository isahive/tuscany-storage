import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import RecurringFee from '@/models/RecurringFee'
import { balanceDelta } from '@/lib/paymentBalance'

// GET  /api/tenants/[id]/balance — current balance + breakdown
// POST /api/tenants/[id]/balance — same but forces a recompute from the ledger
//
// Source of truth: the running balance walks every Payment row applying
// `balanceDelta`. The result is persisted both on the last row (balanceAfter)
// and on tenant.balance.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    if (session.user.role !== 'admin' && session.user.id !== params.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const tenant = await Tenant.findById(params.id)
    if (!tenant) return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })

    const lease = await Lease.findOne({ tenantId: params.id, status: 'active' })

    // Pull every row once and aggregate. Cheaper than 3 separate queries and
    // gives us both the breakdown (charges vs payments) and the running balance.
    const rows = await Payment.find({ tenantId: params.id })
      .sort({ createdAt: 1, _id: 1 })
      .select('amount status direction')
      .lean<Array<{ amount: number; status: string; direction?: string }>>()

    let running = 0
    let totalCharges = 0
    let totalPaid = 0
    let totalRefunded = 0
    for (const r of rows) {
      const direction = (r.direction ?? 'charge') as 'charge' | 'payment'
      running += balanceDelta({ direction, status: r.status as any, amount: r.amount })
      if (direction === 'charge') {
        totalCharges += r.amount
      } else if (r.status === 'refunded') {
        totalRefunded += r.amount
      } else if (r.status !== 'failed') {
        totalPaid += r.amount
      }
    }

    // Keep tenant.balance in sync with the computed running.
    if (tenant.balance !== running) {
      tenant.balance = running
      await tenant.save()
    }

    const balance = running
    const outstanding = balance > 0 ? balance : 0
    const credit = balance < 0 ? Math.abs(balance) : 0

    const recurringFeesCount = await RecurringFee.countDocuments({
      tenantId: params.id,
      active: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        balance,
        outstanding,
        credit,
        totalCharges,
        totalPaid,
        totalRefunded,
        monthlyRate: lease?.monthlyRate ?? 0,
        recurringBillingActive: !!tenant.autopayEnabled,
        recurringFeesCount,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return GET(req, { params })
}
