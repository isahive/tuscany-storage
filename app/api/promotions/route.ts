import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Promotion from '@/models/Promotion'
import {
  disallowedEditFields,
  isPromotionLocked,
  unitTypeExclusivityConflict,
  validateDateWindow,
} from '@/lib/promotions'

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
  beginsAfterCycles: z.number().int().min(0).max(12),
  noExpiration: z.boolean(),
  durationCycles: z.number().int().min(1),
})

function adminLabel(session: { user?: { name?: string | null; email?: string | null } }): string {
  return session.user?.name ?? session.user?.email ?? 'admin'
}

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

    // Storable date window rule: endDate must be at least 1 day after start.
    const dateCheck = validateDateWindow(parsed.data.startDate, parsed.data.endDate)
    if (!dateCheck.ok) {
      return NextResponse.json({ success: false, error: 'End date must be at least one day after the start date.' }, { status: 400 })
    }

    await connectDB()

    // Storable rule: one unit type cannot appear on both a promo_code AND an
    // automatic active promo. Manual stacks freely.
    if (parsed.data.method !== 'manual') {
      const existing = await Promotion.find({ status: 'active' }).select('_id method unitTypes allUnitTypes status').lean<Array<{ _id: any; method: 'manual' | 'promo_code' | 'automatic'; unitTypes: string[]; allUnitTypes?: boolean; status: 'active' | 'retired' }>>()
      const conflicts = unitTypeExclusivityConflict({
        proposed: parsed.data,
        existing: existing.map((e) => ({ ...e, _id: String(e._id) })),
      })
      if (conflicts.length > 0) {
        return NextResponse.json(
          { success: false, error: `Unit type(s) ${conflicts.join(', ')} are already on another promo_code/automatic promotion.` },
          { status: 409 },
        )
      }
    }

    const promo = await Promotion.create({
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      createdBy: adminLabel(session),
      updatedBy: adminLabel(session),
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

    const existing = await Promotion.findById(id)
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    // Reject edits to locked fields. Method is always locked; the rest lock
    // after the first apply.
    const disallowed = disallowedEditFields(
      { appliedCount: existing.appliedCount },
      parsed.data as Record<string, unknown>,
    )
    if (disallowed.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot edit ${disallowed.join(', ')} — ${isPromotionLocked(existing) ? 'promotion has already been applied to a rental.' : 'method cannot be changed after creation.'}`,
        },
        { status: 409 },
      )
    }

    // Storable: a unit type with a rental holding this promo can't be removed.
    if (parsed.data.unitTypes !== undefined) {
      const Lease = (await import('@/models/Lease')).default
      const Unit = (await import('@/models/Unit')).default
      const usedLeases = await Lease.find({ appliedPromotionId: id, status: 'active' })
        .select('unitId').lean<Array<{ unitId: any }>>()
      if (usedLeases.length > 0) {
        const unitIds = usedLeases.map((l) => l.unitId)
        const units = await Unit.find({ _id: { $in: unitIds } }).select('type').lean<Array<{ type: string }>>()
        const inUseTypes = new Set(units.map((u) => u.type))
        const proposedTypes = parsed.data.allUnitTypes ? null : new Set(parsed.data.unitTypes ?? [])
        if (proposedTypes) {
          const removed = [...inUseTypes].filter((t) => !proposedTypes.has(t))
          if (removed.length > 0) {
            return NextResponse.json(
              { success: false, error: `Cannot remove unit type(s) ${removed.join(', ')} — active rentals still use this promotion.` },
              { status: 409 },
            )
          }
        }
      }
    }

    // Date window check (only if either date is touched).
    if (parsed.data.startDate !== undefined || parsed.data.endDate !== undefined) {
      const nextStart = parsed.data.startDate ?? existing.startDate.toISOString()
      const nextEnd = parsed.data.endDate !== undefined
        ? parsed.data.endDate
        : (existing.endDate ? existing.endDate.toISOString() : null)
      const check = validateDateWindow(nextStart, nextEnd)
      if (!check.ok) {
        return NextResponse.json({ success: false, error: 'End date must be at least one day after the start date.' }, { status: 400 })
      }
    }

    // Re-validate unit-type exclusivity if types or method changed.
    if (parsed.data.unitTypes !== undefined || parsed.data.allUnitTypes !== undefined) {
      const method = existing.method // method is locked, so safe to read from existing
      if (method !== 'manual') {
        const others = await Promotion.find({ status: 'active', _id: { $ne: existing._id } })
          .select('_id method unitTypes allUnitTypes status').lean<Array<{ _id: any; method: 'manual' | 'promo_code' | 'automatic'; unitTypes: string[]; allUnitTypes?: boolean; status: 'active' | 'retired' }>>()
        const conflicts = unitTypeExclusivityConflict({
          proposed: {
            id: String(existing._id),
            method,
            unitTypes: parsed.data.unitTypes ?? existing.unitTypes,
            allUnitTypes: parsed.data.allUnitTypes ?? existing.allUnitTypes,
          },
          existing: others.map((e) => ({ ...e, _id: String(e._id) })),
        })
        if (conflicts.length > 0) {
          return NextResponse.json(
            { success: false, error: `Unit type(s) ${conflicts.join(', ')} are already on another promo_code/automatic promotion.` },
            { status: 409 },
          )
        }
      }
    }

    const update: Record<string, unknown> = { ...parsed.data, updatedBy: adminLabel(session) }
    if (parsed.data.startDate) update.startDate = new Date(parsed.data.startDate)
    if (parsed.data.endDate !== undefined) update.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null

    const promo = await Promotion.findByIdAndUpdate(id, { $set: update }, { new: true })

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
      // Can't delete — retire instead. Storable parity: retired promos stay
      // on existing rentals; they only drop off the picker.
      promo.status = 'retired'
      promo.retiredAt = new Date()
      promo.updatedBy = adminLabel(session)
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
