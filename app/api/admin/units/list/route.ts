import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import MoveOutRequest from '@/models/MoveOutRequest'
import { computeDisplayStatus } from '@/lib/unitStatus'

/**
 * GET /api/admin/units/list?status=…
 *
 * Powers Storable's Unit List View. One row per unit with tenant + balance.
 *
 * Storable rule (per docs): "If the customer has more than one unit, each
 * unit will show the total balance on the customer's account." We pull
 * `Tenant.balance` once and assign it to every unit currently held by that
 * tenant, so admins reading any row see the tenant's true open exposure.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const status = req.nextUrl.searchParams.get('status') ?? undefined

    const units = await Unit.find()
      .select('unitNumber size type floor price status currentTenantId')
      .sort({ unitNumber: 1 })
      .lean<Array<any>>()

    const tenantIds = units.map((u) => u.currentTenantId).filter(Boolean)
    const unitIds = units.map((u) => u._id)
    const now = new Date()

    const [tenants, leases, oldestUnpaid, pendingMoveOuts] = await Promise.all([
      tenantIds.length
        ? Tenant.find({ _id: { $in: tenantIds } })
            .select('firstName lastName email phone status balance')
            .lean<Array<any>>()
        : Promise.resolve([] as any[]),
      Lease.find({ unitId: { $in: unitIds }, status: { $in: ['active', 'pending_moveout'] } })
        .select('unitId tenantId status auctionDate auctionScheduledAt')
        .lean<Array<any>>(),
      tenantIds.length
        ? Payment.aggregate([
            { $match: { tenantId: { $in: tenantIds as any }, type: 'rent', status: { $in: ['pending', 'failed'] } } },
            { $sort: { dueDate: 1, periodEnd: 1 } },
            { $group: { _id: '$tenantId', dueDate: { $first: '$dueDate' }, periodEnd: { $first: '$periodEnd' } } },
          ])
        : Promise.resolve([] as any[]),
      MoveOutRequest.find({ unitId: { $in: unitIds }, status: 'pending' }).select('unitId').lean<Array<any>>(),
    ])

    const tenantById = new Map<string, any>(tenants.map((t) => [String(t._id), t]))
    const leaseByUnit = new Map<string, any>(leases.map((l) => [String(l.unitId), l]))
    const unpaidByTenant = new Map<string, any>(oldestUnpaid.map((u: any) => [String(u._id), u]))
    const pendingMoveOutUnits = new Set<string>(pendingMoveOuts.map((m) => String(m.unitId)))

    const rows = units.map((u) => {
      const tenant = u.currentTenantId ? tenantById.get(String(u.currentTenantId)) : null
      const lease = leaseByUnit.get(String(u._id)) ?? null
      const oldest = tenant ? unpaidByTenant.get(String(tenant._id)) ?? null : null
      const displayStatus = computeDisplayStatus({
        unitStatus: u.status,
        lease: lease
          ? { status: lease.status, auctionDate: lease.auctionDate ?? null, auctionScheduledAt: lease.auctionScheduledAt ?? null }
          : null,
        tenant: tenant ? { status: tenant.status } : null,
        oldestUnpaid: oldest ? { dueDate: oldest.dueDate, periodEnd: oldest.periodEnd } : null,
        hasPendingMoveOutRequest: pendingMoveOutUnits.has(String(u._id)),
        now,
      })

      return {
        _id: String(u._id),
        unitNumber: u.unitNumber,
        size: u.size,
        type: u.type,
        floor: u.floor,
        price: u.price,
        rawStatus: u.status,
        displayStatus,
        tenantId: tenant ? String(tenant._id) : null,
        tenantName: tenant ? `${tenant.firstName ?? ''} ${tenant.lastName ?? ''}`.trim() : null,
        tenantPhone: tenant?.phone ?? null,
        tenantEmail: tenant?.email ?? null,
        // Storable: every unit a tenant holds shows the same total balance.
        // Source is the denormalized Tenant.balance.
        tenantBalance: tenant?.balance ?? 0,
      }
    })

    // Apply the status filter AFTER computing display status so admins can
    // filter by the operational state (e.g. "late") not just the persisted
    // 4-value Unit.status.
    const filtered = status
      ? rows.filter((r) => r.displayStatus === status || r.rawStatus === status)
      : rows

    return NextResponse.json({ success: true, data: { rows: filtered, total: filtered.length } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
