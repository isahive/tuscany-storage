import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'

const schema = z.object({
  /** ISO date for the scheduled auction. Pass null to clear. */
  auctionDate: z.string().nullable(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/units/[id]/schedule-auction
 *
 * Sets (or clears) the active lease's `auctionDate`. The unitStatus resolver
 * promotes any lease with an auctionDate to display status `auction` — this
 * lets staff flag a unit for the lien/auction queue in one click.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    await connectDB()

    const unit = await Unit.findById(id)
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })

    const lease = await Lease.findOne({
      unitId: unit._id,
      status: { $in: ['active', 'pending_moveout'] },
    })
    if (!lease) {
      return NextResponse.json({ success: false, error: 'No active lease on this unit' }, { status: 422 })
    }

    if (parsed.data.auctionDate === null) {
      lease.auctionDate = undefined
      lease.auctionScheduledAt = undefined
    } else {
      const d = new Date(parsed.data.auctionDate)
      if (isNaN(d.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid auctionDate' }, { status: 400 })
      }
      lease.auctionDate = d
      lease.auctionScheduledAt = new Date()
    }
    await lease.save()

    return NextResponse.json({
      success: true,
      data: { auctionDate: lease.auctionDate ?? null },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
