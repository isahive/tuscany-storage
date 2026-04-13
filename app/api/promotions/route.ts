import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Promotion from '@/models/Promotion'

// ── Validation ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  method: z.enum(['manual', 'promo_code', 'automatic']),
  promoCode: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0),
  unitTypes: z.array(z.string()),
  allUnitTypes: z.boolean(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  beginsImmediately: z.boolean(),
  beginsAfterCycles: z.number().int().min(0),
  noExpiration: z.boolean(),
  durationCycles: z.number().int().min(1),
})

// ── GET /api/promotions ──────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const promotions = await Promotion.find({}).sort({ createdAt: -1 }).lean()

    return NextResponse.json({ success: true, data: promotions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ── POST /api/promotions ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    await connectDB()

    const promo = await Promotion.create({
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    })

    return NextResponse.json({ success: true, data: promo }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ── PUT /api/promotions ──────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...rest } = body
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })

    const parsed = createSchema.partial().safeParse(rest)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    await connectDB()

    const update: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.startDate) update.startDate = new Date(parsed.data.startDate)
    if (parsed.data.endDate !== undefined) update.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null

    const promo = await Promotion.findByIdAndUpdate(id, { $set: update }, { new: true })
    if (!promo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: promo })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ── DELETE /api/promotions ───────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })

    await connectDB()

    const promo = await Promotion.findById(id)
    if (!promo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    if (promo.appliedCount > 0) {
      // Can't delete — retire instead
      promo.status = 'retired'
      await promo.save()
      return NextResponse.json({ success: true, data: promo, retired: true })
    }

    await Promotion.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
