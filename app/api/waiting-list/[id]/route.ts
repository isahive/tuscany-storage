import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import WaitingList from '@/models/WaitingList'

interface RouteContext {
  params: Promise<{ id: string }>
}

const updateWaitingListSchema = z.object({
  status: z.enum(['waiting', 'notified', 'converted', 'expired']).optional(),
  notifiedAt: z.string().datetime().optional(),
  notifiedUnitId: z.string().optional(),
  notes: z.string().optional(),
})

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()

    const parsed = updateWaitingListSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const updateData: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.notifiedAt) {
      updateData.notifiedAt = new Date(parsed.data.notifiedAt)
    }

    const entry = await WaitingList.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })

    if (!entry) {
      return NextResponse.json({ success: false, error: 'Waiting list entry not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: entry })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params

    await connectDB()

    const entry = await WaitingList.findByIdAndDelete(id)
    if (!entry) {
      return NextResponse.json({ success: false, error: 'Waiting list entry not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
