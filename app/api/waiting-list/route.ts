import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { parsePaginationParams } from '@/lib/utils'
import WaitingList from '@/models/WaitingList'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    // Only admins can view waiting list (contains PII)
    if (session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = req.nextUrl
    const { page, limit, skip } = parsePaginationParams(searchParams)
    const status = searchParams.get('status')

    const filter: Record<string, unknown> = {}
    if (status) filter.status = status

    const [items, total] = await Promise.all([
      WaitingList.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      WaitingList.countDocuments(filter),
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

const createWaitingListSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  preferredSize: z.string().min(1),
  preferredType: z.string().optional(),
  desiredMoveInDate: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limit public endpoint
    const { rateLimit } = await import('@/lib/rateLimit')
    const rateLimited = rateLimit(req, { maxRequests: 5, windowMs: 60 * 1000 })
    if (rateLimited) return rateLimited

    // Public endpoint - no auth required
    const body = await req.json()
    const parsed = createWaitingListSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const entry = await WaitingList.create({
      ...parsed.data,
      desiredMoveInDate: parsed.data.desiredMoveInDate
        ? new Date(parsed.data.desiredMoveInDate)
        : undefined,
      status: 'waiting',
    })

    return NextResponse.json({ success: true, data: entry }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
