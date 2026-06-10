import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Payment from '@/models/Payment'
import MoveOutRequest from '@/models/MoveOutRequest'
import { computeDisplayStatus } from '@/lib/unitStatus'

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = req.nextUrl
    const rawLimit = searchParams.get('limit') || '20'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const size = searchParams.get('size')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')

    const filter: Record<string, unknown> = {}

    if (status) filter.status = status
    if (type) filter.type = type
    if (size) filter.size = size

    if (minPrice || maxPrice) {
      const priceFilter: Record<string, number> = {}
      if (minPrice) priceFilter.$gte = parseInt(minPrice, 10)
      if (maxPrice) priceFilter.$lte = parseInt(maxPrice, 10)
      filter.price = priceFilter
    }

    const total = await Unit.countDocuments(filter)
    const parsedLimit = parseInt(rawLimit, 10)
    const limit =
      rawLimit === 'all' || isNaN(parsedLimit) || parsedLimit < 1
        ? total
        : Math.min(parsedLimit, total)
    const skip = (page - 1) * limit

    const items = await Unit.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ unitNumber: 1 })
      .lean()

    // Enrich each unit with the derived "display status" (Auction, Late, etc).
    // Storable Easy treats those as computed-on-read state — we mirror that
    // here so the /admin/units grid reflects operational reality instead of
    // the 4-value persisted Unit.status.
    const tenantIds = items.map((u: any) => u.currentTenantId).filter(Boolean)
    const unitIds = items.map((u: any) => u._id)
    const now = new Date()

    const [leases, tenants, oldestUnpaid, pendingMoveOuts] = await Promise.all([
      Lease.find({ unitId: { $in: unitIds }, status: { $in: ['active', 'pending_moveout'] } })
        .select('unitId tenantId status auctionDate auctionScheduledAt')
        .lean(),
      tenantIds.length
        ? Tenant.find({ _id: { $in: tenantIds } }).select('status').lean()
        : Promise.resolve([] as any[]),
      // Oldest unpaid rent line per tenant — drives Late/Pre-Lien/Lien tiers.
      tenantIds.length
        ? Payment.aggregate([
            {
              $match: {
                tenantId: { $in: tenantIds as any },
                type: 'rent',
                status: { $in: ['pending', 'failed'] },
              },
            },
            { $sort: { dueDate: 1, periodEnd: 1 } },
            {
              $group: {
                _id: '$tenantId',
                dueDate: { $first: '$dueDate' },
                periodEnd: { $first: '$periodEnd' },
              },
            },
          ])
        : Promise.resolve([] as any[]),
      MoveOutRequest.find({ unitId: { $in: unitIds }, status: 'pending' })
        .select('unitId')
        .lean(),
    ])

    const leaseByUnit = new Map<string, any>(leases.map((l: any) => [l.unitId.toString(), l]))
    const tenantById = new Map<string, any>(tenants.map((t: any) => [t._id.toString(), t]))
    const unpaidByTenant = new Map<string, any>(
      oldestUnpaid.map((u: any) => [u._id.toString(), u]),
    )
    const pendingByUnit = new Set<string>(pendingMoveOuts.map((m: any) => m.unitId.toString()))

    const enriched = items.map((u: any) => {
      const tenantId = u.currentTenantId?.toString?.()
      const tenant = tenantId ? tenantById.get(tenantId) : null
      const lease = leaseByUnit.get(u._id.toString()) ?? null
      const oldest = tenantId ? unpaidByTenant.get(tenantId) ?? null : null
      const displayStatus = computeDisplayStatus({
        unitStatus: u.status,
        lease: lease
          ? {
              status: lease.status,
              auctionDate: lease.auctionDate ?? null,
              auctionScheduledAt: lease.auctionScheduledAt ?? null,
            }
          : null,
        tenant: tenant ? { status: tenant.status } : null,
        oldestUnpaid: oldest ? { dueDate: oldest.dueDate, periodEnd: oldest.periodEnd } : null,
        hasPendingMoveOutRequest: pendingByUnit.has(u._id.toString()),
        now,
      })
      return { ...u, displayStatus }
    })

    return NextResponse.json({
      success: true,
      data: {
        items: enriched,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

const createUnitSchema = z.object({
  unitNumber: z.string().min(1),
  size: z.string().min(1),
  width: z.number().positive(),
  depth: z.number().positive(),
  type: z.enum(['standard', 'climate_controlled', 'drive_up', 'vehicle_outdoor']),
  price: z.number().int().positive(),
  features: z.array(z.string()).optional(),
  notes: z.string().optional(),
  gridX: z.number().int().min(0).optional(),
  gridY: z.number().int().min(0).optional(),
  gridFloor: z.number().int().min(1).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createUnitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const existing = await Unit.findOne({ unitNumber: parsed.data.unitNumber })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Unit number already exists' }, { status: 409 })
    }

    const sqft = parsed.data.width * parsed.data.depth

    const createdByName = session.user.name || session.user.email || undefined
    const unit = await Unit.create({
      ...parsed.data,
      sqft,
      features: parsed.data.features ?? [],
      createdByName,
    })

    return NextResponse.json({ success: true, data: unit }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
