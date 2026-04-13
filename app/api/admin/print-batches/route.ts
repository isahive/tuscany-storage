import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { parsePaginationParams } from '@/lib/utils'
import PrintBatch from '@/models/PrintBatch'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = req.nextUrl
    const { page, limit, skip } = parsePaginationParams(searchParams)
    const status = searchParams.get('status')

    const filter: Record<string, unknown> = {}
    if (status) filter.status = status

    const [items, total] = await Promise.all([
      PrintBatch.find(filter)
        .populate('items.tenantId', 'firstName lastName')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      PrintBatch.countDocuments(filter),
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

const createBatchSchema = z.object({
  items: z.array(z.object({
    tenantId: z.string().min(1),
    unitNumber: z.string().min(1),
    documentType: z.string().min(1),
    balance: z.number().min(0),
  })).min(1),
  format: z.enum(['letter', 'postcard']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createBatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const batch = await PrintBatch.create({
      items: parsed.data.items,
      format: parsed.data.format ?? 'letter',
      status: 'created',
      createdBy: session.user.name ?? session.user.email ?? 'admin',
    })

    return NextResponse.json({ success: true, data: batch }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
