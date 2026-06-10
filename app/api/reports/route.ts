import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import Product from '@/models/Product'
import MoveOutRequest from '@/models/MoveOutRequest'
import WaitingList from '@/models/WaitingList'
import AccessLog from '@/models/AccessLog'
import VisitorAccess from '@/models/VisitorAccess'
import Note from '@/models/Note'
import Promotion from '@/models/Promotion'
import Notification from '@/models/Notification'

// GET /api/reports?type=revenues&from=2026-01-01&to=2026-04-30
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = req.nextUrl
    const type = searchParams.get('type') ?? ''
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const dateFilter: Record<string, unknown> = {}
    if (from) dateFilter.$gte = new Date(from)
    if (to) dateFilter.$lte = new Date(to + 'T23:59:59.999Z')
    const hasDate = Object.keys(dateFilter).length > 0

    switch (type) {
      // ── Accounting / Financials ──────────────────────────────────────
      case 'revenues': {
        const match: Record<string, unknown> = { status: 'succeeded' }
        if (hasDate) match.createdAt = dateFilter
        const payments = await Payment.find(match)
          .populate('tenantId', 'firstName lastName')
          .populate('leaseId', 'unitId')
          .sort({ createdAt: -1 })
          .lean()
        const rows = payments.map((p: any) => ({
          date: p.createdAt,
          tenant: p.tenantId ? `${p.tenantId.firstName} ${p.tenantId.lastName}` : 'N/A',
          type: p.type,
          method: p.method,
          amount: p.amount,
          description: p.description || '',
        }))
        const total = rows.reduce((s: number, r: any) => s + r.amount, 0)
        return NextResponse.json({ success: true, data: { rows, summary: { total } } })
      }

      case 'sales-tax': {
        const match: Record<string, unknown> = { status: 'succeeded' }
        if (hasDate) match.createdAt = dateFilter
        const payments = await Payment.find(match).lean()
        // Estimate tax from retail sales (type === 'other')
        const taxable = payments.filter((p: any) => p.type === 'other')
        const totalSales = taxable.reduce((s: number, p: any) => s + p.amount, 0)
        return NextResponse.json({
          success: true,
          data: {
            rows: [{ category: 'Retail Sales', totalSales, estimatedTax: Math.round(totalSales * 0.0975) }],
            summary: { totalSales },
          },
        })
      }

      case 'refunds': {
        const match: Record<string, unknown> = { status: 'refunded' }
        if (hasDate) match.createdAt = dateFilter
        const payments = await Payment.find(match)
          .populate('tenantId', 'firstName lastName')
          .sort({ createdAt: -1 })
          .lean()
        const rows = payments.map((p: any) => ({
          date: p.createdAt,
          tenant: p.tenantId ? `${p.tenantId.firstName} ${p.tenantId.lastName}` : 'N/A',
          amount: p.amount,
          type: p.type,
          method: p.method,
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.reduce((s: number, r: any) => s + r.amount, 0) } } })
      }

      case 'retail-sales': {
        const match: Record<string, unknown> = { status: 'succeeded', type: 'other' }
        if (hasDate) match.createdAt = dateFilter
        const payments = await Payment.find(match)
          .populate('tenantId', 'firstName lastName')
          .sort({ createdAt: -1 })
          .lean()
        const rows = payments.map((p: any) => ({
          date: p.createdAt,
          tenant: p.tenantId ? `${p.tenantId.firstName} ${p.tenantId.lastName}` : 'N/A',
          amount: p.amount,
          description: p.description || '',
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.reduce((s: number, r: any) => s + r.amount, 0) } } })
      }

      case 'occupancy': {
        const units = await Unit.find({}).lean()
        const total = units.length
        const occupied = units.filter((u: any) => u.status === 'occupied').length
        const available = units.filter((u: any) => u.status === 'available').length
        const reserved = units.filter((u: any) => u.status === 'reserved').length
        const maintenance = units.filter((u: any) => u.status === 'maintenance').length
        const rate = total > 0 ? Math.round((occupied / total) * 10000) / 100 : 0

        // By type
        const byType: Record<string, { total: number; occupied: number }> = {}
        units.forEach((u: any) => {
          if (!byType[u.type]) byType[u.type] = { total: 0, occupied: 0 }
          byType[u.type].total++
          if (u.status === 'occupied') byType[u.type].occupied++
        })
        const rows = Object.entries(byType).map(([t, v]) => ({
          type: t,
          total: v.total,
          occupied: v.occupied,
          available: v.total - v.occupied,
          rate: v.total > 0 ? Math.round((v.occupied / v.total) * 10000) / 100 : 0,
        }))

        return NextResponse.json({
          success: true,
          data: {
            rows,
            summary: { total, occupied, available, reserved, maintenance, rate },
          },
        })
      }

      case 'daily-close': {
        const match: Record<string, unknown> = { status: 'succeeded' }
        if (hasDate) match.createdAt = dateFilter
        const payments = await Payment.find(match).sort({ createdAt: -1 }).lean()
        // Group by date
        const byDate: Record<string, { count: number; total: number }> = {}
        payments.forEach((p: any) => {
          const d = new Date(p.createdAt).toISOString().slice(0, 10)
          if (!byDate[d]) byDate[d] = { count: 0, total: 0 }
          byDate[d].count++
          byDate[d].total += p.amount
        })
        const rows = Object.entries(byDate)
          .map(([date, v]) => ({ date, transactions: v.count, total: v.total }))
          .sort((a, b) => b.date.localeCompare(a.date))
        return NextResponse.json({ success: true, data: { rows, summary: { grandTotal: rows.reduce((s, r) => s + r.total, 0) } } })
      }

      // ── Customers ────────────────────────────────────────────────────
      case 'tenant-data': {
        const tenants = await Tenant.find({}).sort({ lastName: 1, firstName: 1 }).lean()
        const rows = tenants.map((t: any) => ({
          name: `${t.firstName} ${t.lastName}`,
          email: t.email,
          phone: t.phone,
          address: [t.address, t.addressLine2, t.city, t.state, t.zip].filter(Boolean).join(', '),
          status: t.status,
          balance: t.balance,
          createdAt: t.createdAt,
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'reservations': {
        const match: Record<string, unknown> = { status: 'pending' }
        const leases = await Lease.find(match)
          .populate('tenantId', 'firstName lastName email phone')
          .populate('unitId', 'unitNumber size type')
          .sort({ createdAt: -1 })
          .lean()
        const rows = leases.map((l: any) => ({
          date: l.createdAt,
          tenant: l.tenantId ? `${l.tenantId.firstName} ${l.tenantId.lastName}` : 'N/A',
          email: l.tenantId?.email ?? '',
          phone: l.tenantId?.phone ?? '',
          unit: l.unitId?.unitNumber ?? '',
          size: l.unitId?.size ?? '',
          rate: l.monthlyRate,
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'next-bill-due': {
        const leases = await Lease.find({ status: 'active' })
          .populate('tenantId', 'firstName lastName balance')
          .populate('unitId', 'unitNumber size')
          .sort({ billingDay: 1 })
          .lean()
        const today = new Date()
        const rows = leases.map((l: any) => {
          const nextDue = new Date(today.getFullYear(), today.getMonth(), l.billingDay)
          if (nextDue < today) nextDue.setMonth(nextDue.getMonth() + 1)
          return {
            tenant: l.tenantId ? `${l.tenantId.firstName} ${l.tenantId.lastName}` : 'N/A',
            unit: l.unitId?.unitNumber ?? '',
            rate: l.monthlyRate,
            billingDay: l.billingDay,
            nextDue,
            balance: l.tenantId?.balance ?? 0,
          }
        })
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'move-in-out': {
        const match: Record<string, unknown> = {}
        if (hasDate) match.startDate = dateFilter
        const leases = await Lease.find(match)
          .populate('tenantId', 'firstName lastName')
          .populate('unitId', 'unitNumber size')
          .sort({ startDate: -1 })
          .lean()
        const rows = leases.map((l: any) => ({
          tenant: l.tenantId ? `${l.tenantId.firstName} ${l.tenantId.lastName}` : 'N/A',
          unit: l.unitId?.unitNumber ?? '',
          size: l.unitId?.size ?? '',
          moveIn: l.startDate,
          moveOut: l.endDate || null,
          status: l.status,
          rate: l.monthlyRate,
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'scheduled-move-outs': {
        const requests = await MoveOutRequest.find({ status: { $in: ['pending', 'approved'] } })
          .populate('tenantId', 'firstName lastName')
          .populate('unitId', 'unitNumber size')
          .sort({ requestedDate: 1 })
          .lean()
        const rows = requests.map((r: any) => ({
          tenant: r.tenantId ? `${r.tenantId.firstName} ${r.tenantId.lastName}` : 'N/A',
          unit: r.unitId?.unitNumber ?? '',
          requestedDate: r.requestedDate,
          status: r.status,
          reason: r.reason || '',
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'waiting-list': {
        const entries = await WaitingList.find({}).sort({ createdAt: -1 }).lean()
        const rows = entries.map((w: any) => ({
          name: w.name,
          email: w.email,
          phone: w.phone,
          preferredSize: w.preferredSize,
          preferredType: w.preferredType,
          status: w.status,
          createdAt: w.createdAt,
          notified: w.notifiedAt ? true : false,
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'lockouts': {
        const tenants = await Tenant.find({ status: 'locked_out' })
          .sort({ lastName: 1 })
          .lean()
        // Get their leases
        const tIds = tenants.map((t: any) => t._id)
        const leases = await Lease.find({ tenantId: { $in: tIds }, status: 'active' })
          .populate('unitId', 'unitNumber size')
          .lean()
        const leaseMap: Record<string, any> = {}
        leases.forEach((l: any) => { leaseMap[l.tenantId.toString()] = l })
        const rows = tenants.map((t: any) => {
          const lease = leaseMap[t._id.toString()]
          return {
            tenant: `${t.firstName} ${t.lastName}`,
            email: t.email,
            phone: t.phone,
            unit: lease?.unitId?.unitNumber ?? 'N/A',
            balance: t.balance,
          }
        })
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'customer-notes': {
        const match: Record<string, unknown> = {}
        if (hasDate) match.createdAt = dateFilter
        const notes = await Note.find(match)
          .populate('tenantId', 'firstName lastName')
          .sort({ createdAt: -1 })
          .limit(500)
          .lean()
        const rows = notes.map((n: any) => ({
          date: n.createdAt,
          tenant: n.tenantId ? `${n.tenantId.firstName} ${n.tenantId.lastName}` : 'N/A',
          content: n.content,
          createdBy: n.createdBy,
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'active-promotions': {
        // Storable's Active Promotions Report — one row per RENTAL that
        // currently has a promo attached, not one row per Promotion document.
        // Includes Date Added, Unit, Customer, Promo, Discount, Begins,
        // Applied, Duration.
        const leases = await Lease.find({
          status: 'active',
          appliedPromotionId: { $ne: null },
        })
          .populate('tenantId', 'firstName lastName')
          .populate('unitId', 'unitNumber')
          .populate('appliedPromotionId')
          .lean()

        const rows = await Promise.all(leases.map(async (l: any) => {
          const promo = l.appliedPromotionId
          const cyclesUsed = await Payment.countDocuments({
            leaseId: l._id,
            type: 'rent',
            status: 'succeeded',
          })

          // "Begins" — positive = cycles remaining until the promo activates;
          // negative = cycles ago it started. Storable uses this to telegraph
          // pending-start promos vs. already-active ones.
          let begins = 0
          if (!promo?.beginsImmediately && promo?.beginsAfterCycles > 0) {
            begins = (promo.beginsAfterCycles ?? 0) - cyclesUsed
          } else {
            begins = -cyclesUsed
          }

          // "Duration" — remaining cycles, or `Continuous` for no-expiration.
          const duration = promo?.noExpiration
            ? 'Continuous'
            : Math.max(0, (promo?.durationCycles ?? 0) - Math.max(0, cyclesUsed - (promo?.beginsAfterCycles ?? 0)))

          return {
            // Date Added — when the lease started or, more accurately, when
            // the promo was attached. We don't yet persist a per-lease
            // attach time, so fall back to the lease's start date.
            dateAdded: l.startDate,
            unitNumber: l.unitId?.unitNumber ?? '',
            unitId: l.unitId?._id ? String(l.unitId._id) : '',
            tenant: l.tenantId ? `${l.tenantId.firstName} ${l.tenantId.lastName}` : 'N/A',
            tenantId: l.tenantId?._id ? String(l.tenantId._id) : '',
            promotion: promo?.name ?? '—',
            promotionId: promo?._id ? String(promo._id) : '',
            promotionRetired: promo?.status === 'retired',
            discount: promo
              ? (promo.discountType === 'percentage'
                  ? `${promo.discountValue}%`
                  : `$${(promo.discountValue / 100).toFixed(2)}`)
              : '—',
            begins,
            applied: cyclesUsed,
            duration,
          }
        }))

        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'storage-agreements': {
        const leases = await Lease.find({ signedAt: { $ne: null } })
          .populate('tenantId', 'firstName lastName')
          .populate('unitId', 'unitNumber size')
          .sort({ signedAt: -1 })
          .lean()
        const rows = leases.map((l: any) => ({
          tenant: l.tenantId ? `${l.tenantId.firstName} ${l.tenantId.lastName}` : 'N/A',
          unit: l.unitId?.unitNumber ?? '',
          signedAt: l.signedAt,
          startDate: l.startDate,
          rate: l.monthlyRate,
          status: l.status,
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      // ── Payments & Deposits ──────────────────────────────────────────
      case 'transactions': {
        const match: Record<string, unknown> = {}
        if (hasDate) match.createdAt = dateFilter
        const payments = await Payment.find(match)
          .populate('tenantId', 'firstName lastName')
          .sort({ createdAt: -1 })
          .lean()
        const rows = payments.map((p: any) => ({
          date: p.createdAt,
          tenant: p.tenantId ? `${p.tenantId.firstName} ${p.tenantId.lastName}` : 'N/A',
          type: p.type,
          method: p.method,
          status: p.status,
          amount: p.amount,
          description: p.description || '',
          stripeId: p.stripePaymentIntentId || '',
        }))
        const completed = rows.filter((r: any) => r.status === 'completed')
        return NextResponse.json({
          success: true,
          data: {
            rows,
            summary: {
              total: rows.length,
              completedTotal: completed.reduce((s: number, r: any) => s + r.amount, 0),
            },
          },
        })
      }

      case 'bank-activity': {
        const match: Record<string, unknown> = { status: 'succeeded', stripePaymentIntentId: { $ne: null } }
        if (hasDate) match.createdAt = dateFilter
        const payments = await Payment.find(match)
          .populate('tenantId', 'firstName lastName')
          .sort({ createdAt: -1 })
          .lean()
        const rows = payments.map((p: any) => ({
          date: p.createdAt,
          tenant: p.tenantId ? `${p.tenantId.firstName} ${p.tenantId.lastName}` : 'N/A',
          amount: p.amount,
          method: p.method,
          stripeId: p.stripePaymentIntentId,
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.reduce((s: number, r: any) => s + r.amount, 0) } } })
      }

      // ── Facility ─────────────────────────────────────────────────────
      case 'access-codes': {
        const tenants = await Tenant.find({ status: { $in: ['active', 'locked_out'] }, gateCode: { $ne: null } })
          .sort({ lastName: 1 })
          .lean()
        const tIds = tenants.map((t: any) => t._id)
        const leases = await Lease.find({ tenantId: { $in: tIds }, status: 'active' })
          .populate('unitId', 'unitNumber')
          .lean()
        const leaseMap: Record<string, string> = {}
        leases.forEach((l: any) => { leaseMap[l.tenantId.toString()] = l.unitId?.unitNumber ?? '' })
        const rows = tenants.map((t: any) => ({
          tenant: `${t.firstName} ${t.lastName}`,
          unit: leaseMap[t._id.toString()] || 'N/A',
          gateCode: t.gateCode,
          phone: t.phone,
          status: t.status,
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'gate-activity': {
        // AccessLog rows now carry either tenantId OR visitorAccessId (visitor
        // passes added 2026-06-02). The Tenant populate handles the former;
        // we fetch visitor names in a second pass so the report shows the
        // human name for both principals rather than "Unknown" for visitors.
        const match: Record<string, unknown> = {}
        if (hasDate) match.createdAt = dateFilter
        const logs = await AccessLog.find(match)
          .populate('tenantId', 'firstName lastName')
          .sort({ createdAt: -1 })
          .limit(500)
          .lean()

        const visitorIds = logs
          .map((l: any) => l.visitorAccessId)
          .filter(Boolean)
        const visitors = visitorIds.length
          ? await VisitorAccess.find({ _id: { $in: visitorIds } })
              .select('_id name purpose')
              .lean()
          : []
        const visitorMap = new Map(
          visitors.map((v: any) => [String(v._id), v]),
        )

        const rows = logs.map((l: any) => {
          let who = 'Unknown'
          let kind: 'Tenant' | 'Visitor' | '—' = '—'
          if (l.tenantId) {
            who = `${l.tenantId.firstName ?? ''} ${l.tenantId.lastName ?? ''}`.trim() || 'Unknown'
            kind = 'Tenant'
          } else if (l.visitorAccessId) {
            const v = visitorMap.get(String(l.visitorAccessId))
            if (v) {
              who = v.purpose ? `${v.name} (${v.purpose})` : v.name
              kind = 'Visitor'
            }
          }
          return {
            timestamp: l.createdAt,
            who,
            kind,
            event: l.eventType,
            gate: l.gateId ?? 'unknown',
            source: l.source,
            notes: l.notes ?? '',
          }
        })
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'unit-list': {
        const units = await Unit.find({}).sort({ unitNumber: 1 }).lean()
        const rows = units.map((u: any) => ({
          unitNumber: u.unitNumber,
          size: u.size,
          sqft: u.sqft,
          type: u.type,
          floor: u.floor,
          price: u.price,
          status: u.status,
          features: (u.features || []).join(', '),
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'management-summary': {
        const units = await Unit.find({}).lean()
        const tenants = await Tenant.find({}).lean()
        const activeLeases = await Lease.find({ status: 'active' }).lean()
        const match: Record<string, unknown> = { status: 'succeeded' }
        const now = new Date()
        match.createdAt = {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lte: now,
        }
        const monthPayments = await Payment.find(match).lean()

        const totalUnits = units.length
        const occupied = units.filter((u: any) => u.status === 'occupied').length
        const totalTenants = tenants.filter((t: any) => t.status === 'active').length
        const monthRevenue = monthPayments.reduce((s: number, p: any) => s + p.amount, 0)
        const totalPotentialRevenue = activeLeases.reduce((s: number, l: any) => s + l.monthlyRate, 0)
        const totalBalance = tenants.reduce((s: number, t: any) => s + (t.balance || 0), 0)

        return NextResponse.json({
          success: true,
          data: {
            rows: [
              { metric: 'Total Units', value: totalUnits },
              { metric: 'Occupied Units', value: occupied },
              { metric: 'Occupancy Rate', value: `${totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0}%` },
              { metric: 'Active Tenants', value: totalTenants },
              { metric: 'Monthly Potential Revenue', value: totalPotentialRevenue },
              { metric: 'Revenue This Month', value: monthRevenue },
              { metric: 'Outstanding Balances', value: totalBalance },
            ],
            summary: { totalUnits, occupied, totalTenants, monthRevenue },
          },
        })
      }

      case 'rent-roll': {
        const leases = await Lease.find({ status: 'active' })
          .populate('tenantId', 'firstName lastName balance')
          .populate('unitId', 'unitNumber size type')
          .sort({ 'unitId.unitNumber': 1 })
          .lean()
        const rows = leases.map((l: any) => ({
          unit: l.unitId?.unitNumber ?? '',
          size: l.unitId?.size ?? '',
          type: l.unitId?.type ?? '',
          tenant: l.tenantId ? `${l.tenantId.firstName} ${l.tenantId.lastName}` : 'N/A',
          monthlyRate: l.monthlyRate,
          deposit: l.deposit,
          billingDay: l.billingDay,
          startDate: l.startDate,
          balance: l.tenantId?.balance ?? 0,
        }))
        const totalRent = rows.reduce((s: number, r: any) => s + r.monthlyRate, 0)
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length, totalMonthlyRent: totalRent } } })
      }

      case 'square-footage': {
        const units = await Unit.find({}).lean()
        const byType: Record<string, { count: number; totalSqft: number; occupied: number }> = {}
        units.forEach((u: any) => {
          if (!byType[u.type]) byType[u.type] = { count: 0, totalSqft: 0, occupied: 0 }
          byType[u.type].count++
          byType[u.type].totalSqft += u.sqft || 0
          if (u.status === 'occupied') byType[u.type].occupied++
        })
        const rows = Object.entries(byType).map(([type, v]) => ({
          type,
          units: v.count,
          totalSqft: v.totalSqft,
          occupiedSqft: Math.round((v.occupied / v.count) * v.totalSqft),
          occupiedUnits: v.occupied,
        }))
        return NextResponse.json({
          success: true,
          data: {
            rows,
            summary: { totalSqft: rows.reduce((s, r) => s + r.totalSqft, 0) },
          },
        })
      }

      case 'retail-inventory': {
        // Storable's Retail Inventory Summary — current stock per product PLUS
        // movement totals over the optional date range. Range comes from
        // `from` / `to` query params (ISO strings).
        const InventoryAdjustment = (await import('@/models/InventoryAdjustment')).default
        const products = await Product.find({}).sort({ name: 1 }).lean()

        const fromParam = req.nextUrl.searchParams.get('from')
        const toParam = req.nextUrl.searchParams.get('to')
        const range: Record<string, Date> = {}
        if (fromParam) range.$gte = new Date(fromParam)
        if (toParam) range.$lte = new Date(toParam)
        const filter: Record<string, unknown> = {}
        if (Object.keys(range).length) filter.createdAt = range

        // Aggregate received / adjustment / sold totals per product in window.
        const movements = await InventoryAdjustment.aggregate([
          { $match: filter },
          {
            $group: {
              _id: { productId: '$productId', action: '$action' },
              quantitySum: { $sum: '$quantity' },
              eventCount: { $sum: 1 },
            },
          },
        ])
        const byProduct = new Map<string, { received: number; adjustment: number; sold: number; events: number }>()
        for (const m of movements) {
          const key = String(m._id.productId)
          const entry = byProduct.get(key) ?? { received: 0, adjustment: 0, sold: 0, events: 0 }
          if (m._id.action === 'received') entry.received += m.quantitySum
          else if (m._id.action === 'adjustment') entry.adjustment += m.quantitySum
          else if (m._id.action === 'sale') entry.sold += Math.abs(m.quantitySum)
          entry.events += m.eventCount
          byProduct.set(key, entry)
        }

        const rows = products.map((p: any) => {
          const mvt = byProduct.get(String(p._id)) ?? { received: 0, adjustment: 0, sold: 0, events: 0 }
          return {
            productId: String(p._id),
            name: p.name,
            price: p.price,
            cost: p.cost,
            taxRate: p.taxRate,
            inventory: p.inventory,
            active: p.active,
            margin: p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0,
            received: mvt.received,
            adjustment: mvt.adjustment,
            sold: mvt.sold,
            ledgerEvents: mvt.events,
          }
        })

        const summary = {
          total: rows.length,
          totalSold: rows.reduce((s, r) => s + r.sold, 0),
          totalReceived: rows.reduce((s, r) => s + r.received, 0),
          revenueInWindow: rows.reduce((s, r) => s + r.sold * r.price, 0),
        }
        return NextResponse.json({ success: true, data: { rows, summary } })
      }

      case 'unit-status': {
        const units = await Unit.find({}).sort({ unitNumber: 1 }).lean()
        // Get active leases for tenant info
        const leases = await Lease.find({ status: 'active' })
          .populate('tenantId', 'firstName lastName')
          .lean()
        const leaseByUnit: Record<string, string> = {}
        leases.forEach((l: any) => {
          if (l.unitId) leaseByUnit[l.unitId.toString()] = l.tenantId ? `${l.tenantId.firstName} ${l.tenantId.lastName}` : ''
        })
        const rows = units.map((u: any) => ({
          unitNumber: u.unitNumber,
          size: u.size,
          type: u.type,
          status: u.status,
          tenant: leaseByUnit[u._id.toString()] || '—',
          price: u.price,
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'length-of-stay': {
        const leases = await Lease.find({ status: 'active' })
          .populate('tenantId', 'firstName lastName')
          .populate('unitId', 'unitNumber size')
          .lean()
        const now = new Date()
        const rows = leases.map((l: any) => {
          const start = new Date(l.startDate)
          const months = Math.round((now.getTime() - start.getTime()) / (30.44 * 24 * 60 * 60 * 1000))
          return {
            tenant: l.tenantId ? `${l.tenantId.firstName} ${l.tenantId.lastName}` : 'N/A',
            unit: l.unitId?.unitNumber ?? '',
            size: l.unitId?.size ?? '',
            startDate: l.startDate,
            months,
            rate: l.monthlyRate,
          }
        }).sort((a: any, b: any) => b.months - a.months)
        const avgMonths = rows.length > 0 ? Math.round(rows.reduce((s: number, r: any) => s + r.months, 0) / rows.length) : 0
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length, avgMonths } } })
      }

      case 'vacant-units': {
        const units = await Unit.find({ status: 'available' }).sort({ unitNumber: 1 }).lean()
        const rows = units.map((u: any) => ({
          unitNumber: u.unitNumber,
          size: u.size,
          sqft: u.sqft,
          type: u.type,
          floor: u.floor,
          price: u.price,
          features: (u.features || []).join(', '),
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      case 'tenant-credit': {
        const tenants = await Tenant.find({ balance: { $lt: 0 } }).sort({ balance: 1 }).lean()
        const tIds = tenants.map((t: any) => t._id)
        const leases = await Lease.find({ tenantId: { $in: tIds }, status: 'active' })
          .populate('unitId', 'unitNumber')
          .lean()
        const leaseMap: Record<string, string> = {}
        leases.forEach((l: any) => { leaseMap[l.tenantId.toString()] = l.unitId?.unitNumber ?? '' })
        const rows = tenants.map((t: any) => ({
          tenant: `${t.firstName} ${t.lastName}`,
          unit: leaseMap[t._id.toString()] || 'N/A',
          credit: t.balance,
          email: t.email,
          phone: t.phone,
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { totalCredit: rows.reduce((s: number, r: any) => s + r.credit, 0) } } })
      }

      case 'collections': {
        // All tenants with positive balance (owe money)
        const tenants = await Tenant.find({ balance: { $gt: 0 } }).sort({ balance: -1 }).lean()
        const tIds = tenants.map((t: any) => t._id)
        const leases = await Lease.find({ tenantId: { $in: tIds }, status: 'active' })
          .populate('unitId', 'unitNumber size')
          .lean()
        const leaseMap: Record<string, any> = {}
        leases.forEach((l: any) => { leaseMap[l.tenantId.toString()] = l })

        // Get latest succeeded rent payment to calculate days past due
        const rentPayments = await Payment.find({ tenantId: { $in: tIds }, type: 'rent', status: 'succeeded' })
          .sort({ periodEnd: -1 })
          .lean()
        const lastPaidMap: Record<string, Date> = {}
        rentPayments.forEach((p: any) => {
          const key = p.tenantId.toString()
          if (!lastPaidMap[key]) lastPaidMap[key] = p.periodEnd
        })

        const now = new Date()
        const rows = tenants.map((t: any) => {
          const lease = leaseMap[t._id.toString()]
          const lastPaid = lastPaidMap[t._id.toString()]
          const daysPastDue = lastPaid
            ? Math.max(0, Math.floor((now.getTime() - new Date(lastPaid).getTime()) / (1000 * 60 * 60 * 24)))
            : null
          return {
            tenant: `${t.firstName} ${t.lastName}`,
            email: t.email,
            phone: t.phone,
            unit: lease?.unitId?.unitNumber ?? 'N/A',
            balance: t.balance,
            status: t.status,
            daysPastDue,
          }
        })
        return NextResponse.json({
          success: true,
          data: {
            rows,
            summary: {
              total: rows.length,
              totalOwed: rows.reduce((s: number, r: any) => s + r.balance, 0),
            },
          },
        })
      }

      case 'failed-payments': {
        const match: Record<string, unknown> = { status: 'failed' }
        if (hasDate) match.createdAt = dateFilter
        const payments = await Payment.find(match)
          .populate('tenantId', 'firstName lastName email phone')
          .sort({ createdAt: -1 })
          .lean()
        const rows = payments.map((p: any) => ({
          date: p.createdAt,
          tenant: p.tenantId ? `${p.tenantId.firstName} ${p.tenantId.lastName}` : 'N/A',
          email: p.tenantId?.email ?? '',
          phone: p.tenantId?.phone ?? '',
          amount: p.amount,
          type: p.type,
          reason: p.failureReason || 'Unknown',
          attempts: p.attemptCount,
        }))
        return NextResponse.json({
          success: true,
          data: {
            rows,
            summary: {
              total: rows.length,
              totalAmount: rows.reduce((s: number, r: any) => s + r.amount, 0),
            },
          },
        })
      }

      case 'lost-revenue': {
        // Revenue lost from vacant units + locked-out tenants
        const vacantUnits = await Unit.find({ status: 'available' }).lean()
        const lockedOutTenants = await Tenant.find({ status: 'locked_out' }).lean()
        const tIds = lockedOutTenants.map((t: any) => t._id)
        const leases = await Lease.find({ tenantId: { $in: tIds }, status: 'active' })
          .populate('unitId', 'unitNumber size')
          .lean()

        const vacantRows = vacantUnits.map((u: any) => ({
          source: 'Vacant unit',
          unit: u.unitNumber,
          size: u.size,
          monthlyLoss: u.price,
        }))
        const lockedRows = leases.map((l: any) => ({
          source: 'Locked out (unpaid)',
          unit: l.unitId?.unitNumber ?? '',
          size: l.unitId?.size ?? '',
          monthlyLoss: l.monthlyRate,
        }))
        const rows = [...vacantRows, ...lockedRows]
        return NextResponse.json({
          success: true,
          data: {
            rows,
            summary: {
              vacantCount: vacantRows.length,
              lockedCount: lockedRows.length,
              monthlyLoss: rows.reduce((s: number, r: any) => s + r.monthlyLoss, 0),
              annualLoss: rows.reduce((s: number, r: any) => s + r.monthlyLoss, 0) * 12,
            },
          },
        })
      }

      case 'yearly-revenues': {
        // Aggregate succeeded payments by year/month
        const match: Record<string, unknown> = { status: 'succeeded' }
        if (hasDate) match.createdAt = dateFilter
        const payments = await Payment.find(match).lean()
        const byMonth: Record<string, { rent: number; deposit: number; lateFee: number; other: number; total: number }> = {}
        payments.forEach((p: any) => {
          const d = new Date(p.createdAt)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (!byMonth[key]) byMonth[key] = { rent: 0, deposit: 0, lateFee: 0, other: 0, total: 0 }
          if (p.type === 'rent' || p.type === 'prorated') byMonth[key].rent += p.amount
          else if (p.type === 'deposit') byMonth[key].deposit += p.amount
          else if (p.type === 'late_fee') byMonth[key].lateFee += p.amount
          else byMonth[key].other += p.amount
          byMonth[key].total += p.amount
        })
        const rows = Object.entries(byMonth)
          .map(([month, v]) => ({ month, ...v }))
          .sort((a, b) => a.month.localeCompare(b.month))
        return NextResponse.json({
          success: true,
          data: {
            rows,
            summary: {
              total: rows.reduce((s, r) => s + r.total, 0),
              months: rows.length,
            },
          },
        })
      }

      case 'undelivered-notifications': {
        const match: Record<string, unknown> = { status: { $in: ['failed', 'undelivered'] } }
        if (hasDate) match.createdAt = dateFilter
        const notifs = await Notification.find(match)
          .populate('tenantId', 'firstName lastName email phone')
          .sort({ createdAt: -1 })
          .limit(500)
          .lean()
        const rows = notifs.map((n: any) => ({
          date: n.createdAt,
          tenant: n.tenantId ? `${n.tenantId.firstName} ${n.tenantId.lastName}` : 'Unknown',
          email: n.tenantId?.email ?? '',
          phone: n.tenantId?.phone ?? '',
          type: n.type,
          channel: n.channel,
          subject: n.subject ?? '',
          reason: n.failureReason ?? '',
        }))
        return NextResponse.json({ success: true, data: { rows, summary: { total: rows.length } } })
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown report type: ${type}` }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
