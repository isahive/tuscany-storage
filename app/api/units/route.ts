import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { parsePaginationParams } from '@/lib/utils'
import Unit from '@/models/Unit'

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = req.nextUrl
    const { page, limit, skip } = parsePaginationParams(searchParams)
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

    const [items, total] = await Promise.all([
      Unit.find(filter).skip(skip).limit(limit).sort({ unitNumber: 1 }),
      Unit.countDocuments(filter),
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

const createUnitSchema = z.object({
  unitNumber: z.string().min(1),
  size: z.string().min(1),
  width: z.number().positive(),
  depth: z.number().positive(),
  type: z.enum(['standard', 'climate_controlled', 'drive_up', 'vehicle_outdoor']),
  floor: z.enum(['ground', 'upper']),
  price: z.number().int().positive(),
  features: z.array(z.string()).optional(),
  notes: z.string().optional(),
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

    const unit = await Unit.create({
      ...parsed.data,
      sqft,
      features: parsed.data.features ?? [],
    })

    return NextResponse.json({ success: true, data: unit }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
