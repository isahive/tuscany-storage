import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { parsePaginationParams } from '@/lib/utils'
import Payment from '@/models/Payment'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = req.nextUrl
    const { page, limit, skip } = parsePaginationParams(searchParams)
    const tenantId = searchParams.get('tenantId')
    const leaseId = searchParams.get('leaseId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    const filter: Record<string, unknown> = {}

    // Non-admin tenants can only see their own payments
    if (session.user.role !== 'admin') {
      filter.tenantId = session.user.id
    } else if (tenantId) {
      filter.tenantId = tenantId
    }

    if (leaseId) filter.leaseId = leaseId
    if (status) filter.status = status
    if (type) filter.type = type

    const [items, total] = await Promise.all([
      Payment.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Payment.countDocuments(filter),
    ])

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

const createPaymentSchema = z.object({
  tenantId: z.string().min(1),
  leaseId: z.string().min(1),
  unitId: z.string().min(1),
  amount: z.number().int().positive(),
  type: z.enum(['rent', 'late_fee', 'deposit', 'prorated', 'other']),
  stripePaymentIntentId: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createPaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const payment = await Payment.create({
      ...parsed.data,
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
      currency: 'usd',
      status: 'pending',
      attemptCount: 0,
    })

    return NextResponse.json({ success: true, data: payment }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
