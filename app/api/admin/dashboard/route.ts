import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import WaitingList from '@/models/WaitingList'
import MoveOutRequest from '@/models/MoveOutRequest'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    // ── KPIs ──────────────────────────────────────────────────────────────
    const [units, tenants, waitingListCount] = await Promise.all([
      Unit.find({}).lean(),
      Tenant.find({}).lean(),
      WaitingList.countDocuments({}),
    ])

    const totalUnits = units.length
    const occupiedUnits = units.filter((u: any) => u.status === 'occupied').length
    const availableUnits = units.filter((u: any) => u.status === 'available').length
    const occupancyPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0

    // Revenue MTD
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const mtdPayments = await Payment.find({
      status: 'completed',
      createdAt: { $gte: firstOfMonth, $lte: now },
    }).lean()
    const revenueMtd = mtdPayments.reduce((sum: number, p: any) => sum + p.amount, 0)

    // Delinquent & locked out counts
    const delinquentTenants = tenants.filter((t: any) => t.balance > 0 && t.status !== 'inactive')
    const lockedOutCount = tenants.filter((t: any) => t.status === 'locked_out').length

    const kpis = {
      occupancyPct,
      revenueMtd,
      availableUnits,
      delinquentCount: delinquentTenants.length,
      lockedOutCount,
      waitingListCount,
    }

    // ── Delinquency breakdown ─────────────────────────────────────────────
    const delinqIds = delinquentTenants
      .sort((a: any, b: any) => b.balance - a.balance)
      .slice(0, 10)
      .map((t: any) => t._id)

    const delinqLeases = await Lease.find({
      tenantId: { $in: delinqIds },
      status: 'active',
    })
      .populate('unitId', 'unitNumber')
      .lean()

    const leaseByTenant: Record<string, string> = {}
    delinqLeases.forEach((l: any) => {
      leaseByTenant[l.tenantId.toString()] = l.unitId?.unitNumber ?? 'N/A'
    })

    const delinquent = delinquentTenants
      .sort((a: any, b: any) => b.balance - a.balance)
      .slice(0, 10)
      .map((t: any) => {
        const lease = delinqLeases.find((l: any) => l.tenantId.toString() === t._id.toString()) as any
        let daysPastDue = 0
        if (lease) {
          const billingDay = lease.billingDay || 1
          const lastDue = new Date(now.getFullYear(), now.getMonth(), billingDay)
          if (lastDue > now) lastDue.setMonth(lastDue.getMonth() - 1)
          daysPastDue = Math.max(0, Math.floor((now.getTime() - lastDue.getTime()) / (24 * 60 * 60 * 1000)))
        }

        let stage = 'Late'
        if (t.status === 'locked_out') stage = 'Locked Out'
        else if (daysPastDue > 45) stage = 'Pre-Lien'

        return {
          id: t._id.toString(),
          name: `${t.firstName} ${t.lastName}`,
          unit: leaseByTenant[t._id.toString()] || 'N/A',
          daysPastDue,
          balance: t.balance,
          stage,
        }
      })

    // ── Upcoming move-outs ────────────────────────────────────────────────
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const moveOutRequests = await MoveOutRequest.find({
      status: { $in: ['pending', 'approved'] },
      requestedDate: { $gte: now, $lte: thirtyDaysOut },
    })
      .populate('tenantId', 'firstName lastName balance')
      .populate('unitId', 'unitNumber')
      .sort({ requestedDate: 1 })
      .limit(10)
      .lean()

    const moveOuts = moveOutRequests.map((r: any) => ({
      id: r._id.toString(),
      name: r.tenantId ? `${r.tenantId.firstName} ${r.tenantId.lastName}` : 'N/A',
      unit: r.unitId?.unitNumber ?? 'N/A',
      moveOutDate: r.requestedDate,
      balance: r.tenantId?.balance ?? 0,
    }))

    return NextResponse.json({
      success: true,
      data: { kpis, delinquent, moveOuts },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
