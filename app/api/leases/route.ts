import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = req.nextUrl
    const rawLimit = searchParams.get('limit') || '20'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const tenantId = searchParams.get('tenantId')
    const unitId = searchParams.get('unitId')
    const status = searchParams.get('status')

    const filter: Record<string, unknown> = {}

    // Non-admin tenants can only see their own leases
    if (session.user.role !== 'admin') {
      filter.tenantId = session.user.id
    } else if (tenantId) {
      filter.tenantId = tenantId
    }

    if (unitId) filter.unitId = unitId
    if (status) filter.status = status

    const total = await Lease.countDocuments(filter)
    const parsedLimit = parseInt(rawLimit, 10)
    const limit =
      rawLimit === 'all' || isNaN(parsedLimit) || parsedLimit < 1
        ? total
        : Math.min(parsedLimit, total)
    const skip = (page - 1) * limit

    const items = await Lease.find(filter)
      .populate('unitId', 'unitNumber size type')
      .populate('appliedPromotionId', 'name description method discountType discountValue noExpiration durationCycles status')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })

    return NextResponse.json({
      success: true,
      data: {
        items,
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

const createLeaseSchema = z.object({
  tenantId: z.string().min(1),
  unitId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  monthlyRate: z.number().int().positive(),
  deposit: z.number().int().min(0).optional(),
  proratedFirstMonth: z.number().int().min(0).optional(),
  billingDay: z.number().int().min(1).max(28),
  status: z.enum(['active', 'ended', 'pending_moveout']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createLeaseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const lease = await Lease.create({
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      deposit: parsed.data.deposit ?? 0,
      proratedFirstMonth: parsed.data.proratedFirstMonth ?? 0,
      status: parsed.data.status ?? 'active',
    })

    return NextResponse.json({ success: true, data: lease }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
