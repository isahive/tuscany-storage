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
import Notification from '@/models/Notification'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    // ── Core data ─────────────────────────────────────────────────────────
    const [units, tenants, waitingListCount] = await Promise.all([
      Unit.find({}).lean(),
      Tenant.find({}).lean(),
      WaitingList.countDocuments({}),
    ])

    const totalUnits    = units.length
    const occupiedUnits = units.filter((u: any) => u.status === 'occupied').length
    const availableUnits= units.filter((u: any) => u.status === 'available').length
    const occupancyPct  = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0

    // ── Revenue MTD ───────────────────────────────────────────────────────
    const now           = new Date()
    const firstOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1)
    const mtdPayments   = await Payment.find({
      status: 'succeeded',
      createdAt: { $gte: firstOfMonth, $lte: now },
    }).lean()
    const revenueMtd = mtdPayments.reduce((sum: number, p: any) => sum + p.amount, 0)

    // ── Delinquent / locked-out counts ───────────────────────────────────
    const activeTenants    = tenants.filter((t: any) => t.status !== 'moved_out')
    const delinquentTenants= tenants.filter((t: any) => t.balance > 0 && t.status !== 'inactive' && t.status !== 'moved_out')
    const lockedOutCount   = tenants.filter((t: any) => t.status === 'locked_out').length
    const lateUnitsCount   = tenants.filter((t: any) => t.status === 'delinquent').length

    // ── Awaiting Payment (balance > 0, not yet locked out) ───────────────
    const awaitingTenants      = tenants.filter((t: any) => t.balance > 0 && t.status === 'active')
    const awaitingPaymentCount  = awaitingTenants.length
    const awaitingPaymentAmount = awaitingTenants.reduce((s: number, t: any) => s + t.balance, 0)

    // ── Recurring billing % ───────────────────────────────────────────────
    const autopayCount        = activeTenants.filter((t: any) => t.autopayEnabled).length
    const recurringBillingPct = activeTenants.length > 0
      ? Math.round((autopayCount / activeTenants.length) * 100)
      : 0

    // ── Website rentals % (leases signed via portal = have signedAt) ──────
    const activeLeases        = await Lease.find({ status: 'active' }).lean()
    const signedLeases        = activeLeases.filter((l: any) => l.signedAt)
    const websiteRentalsPct   = activeLeases.length > 0
      ? Math.round((signedLeases.length / activeLeases.length) * 100)
      : 0

    const kpis = {
      occupancyPct,
      revenueMtd,
      availableUnits,
      delinquentCount: delinquentTenants.length,
      lockedOutCount,
      waitingListCount,
      awaitingPaymentCount,
      awaitingPaymentAmount,
      recurringBillingPct,
      websiteRentalsPct,
      lateUnitsCount,
    }

    // ── Revenue by month (last 6 months) ──────────────────────────────────
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const monthlyRevRaw = await Payment.aggregate([
      { $match: { status: 'succeeded', createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ])

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const revenueByMonth: { label: string; value: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const found = monthlyRevRaw.find(
        (r: any) => r._id.year === d.getFullYear() && r._id.month === d.getMonth() + 1
      )
      revenueByMonth.push({ label: MONTH_NAMES[d.getMonth()], value: found?.total ?? 0 })
    }
    revenueByMonth.reverse()

    // ── Occupancy by month (last 6 months, approximate from lease start dates) ─
    // Use current occupancy as a flat value — historical requires snapshots
    const occupancyByMonth = revenueByMonth.map((m) => ({ label: m.label, value: occupancyPct }))

    // ── Undelivered notifications ─────────────────────────────────────────
    const undeliveredRaw = await Notification.find({
      status: { $in: ['failed', 'undelivered'] },
    })
      .populate('tenantId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    const undeliveredNotifications = undeliveredRaw.map((n: any) => ({
      id:      n._id.toString(),
      tenant:  n.tenantId ? `${n.tenantId.firstName} ${n.tenantId.lastName}` : 'Unknown',
      type:    n.type,
      channel: n.channel,
      status:  n.status,
      reason:  n.failureReason ?? null,
      date:    n.createdAt,
    }))

    // ── Delinquency breakdown ──────────────────────────────────────────────
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
      id:          r._id.toString(),
      name:        r.tenantId ? `${r.tenantId.firstName} ${r.tenantId.lastName}` : 'N/A',
      unit:        r.unitId?.unitNumber ?? 'N/A',
      moveOutDate: r.requestedDate,
      balance:     r.tenantId?.balance ?? 0,
    }))

    // ── Tasks (unsigned leases + pending move-outs) ────────────────────────
    const unsignedLeases = await Lease.find({ status: 'active', signedAt: { $exists: false } })
      .populate('tenantId', 'firstName lastName')
      .populate('unitId', 'unitNumber')
      .limit(10)
      .lean()

    const tasks = [
      ...unsignedLeases.map((l: any) => ({
        id:    l._id.toString(),
        label: `Unsigned lease — ${l.tenantId ? `${l.tenantId.firstName} ${l.tenantId.lastName}` : 'N/A'} · Unit ${l.unitId?.unitNumber ?? 'N/A'}`,
        type:  'unsigned_lease',
        href:  l.tenantId?._id ? `/admin/tenants/${l.tenantId._id}` : '/admin/tenants',
      })),
      ...moveOutRequests.filter((r: any) => r.status === 'pending').map((r: any) => ({
        id:    r._id.toString(),
        label: `Pending move-out — ${r.tenantId ? `${r.tenantId.firstName} ${r.tenantId.lastName}` : 'N/A'} · Unit ${r.unitId?.unitNumber ?? 'N/A'}`,
        type:  'move_out',
        href:  `/admin/move-out`,
      })),
    ]

    return NextResponse.json({
      success: true,
      data: {
        kpis,
        delinquent,
        moveOuts,
        revenueByMonth,
        occupancyByMonth,
        undeliveredNotifications,
        tasks,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
