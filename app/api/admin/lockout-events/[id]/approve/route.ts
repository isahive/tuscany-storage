import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import LockoutEvent from '@/models/LockoutEvent'

// POST /api/admin/lockout-events/[id]/approve
// Lock Out Report approve button — the admin acknowledges the unlock so the
// row clears off the "pending" view. Refuses if the row is already approved
// (idempotent + audit-clear).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const evt = await LockoutEvent.findById(params.id)
    if (!evt) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    if (evt.approvedAt) {
      return NextResponse.json({ success: false, error: 'Event is already approved.' }, { status: 409 })
    }

    evt.approvedAt = new Date()
    evt.approvedBy = session.user.name ?? session.user.email ?? 'admin'
    await evt.save()

    return NextResponse.json({ success: true, data: { approvedAt: evt.approvedAt, approvedBy: evt.approvedBy } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
