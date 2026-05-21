import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import MoveOutRequest from '@/models/MoveOutRequest'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Tenant from '@/models/Tenant'
import { sendTemplatedNotification } from '@/lib/sendNotification'

interface RouteContext {
  params: Promise<{ id: string }>
}

// ─── PATCH: Admin — approve or deny a move-out request ───────────────────────

const reviewMoveOutSchema = z.object({
  status: z.enum(['approved', 'denied']),
  adminNotes: z.string().optional(),
})

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()

    const parsed = reviewMoveOutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400 },
      )
    }

    const { status, adminNotes } = parsed.data

    await connectDB()

    const moveOutRequest = await MoveOutRequest.findById(id)
    if (!moveOutRequest) {
      return NextResponse.json(
        { success: false, error: 'Move-out request not found.' },
        { status: 404 },
      )
    }

    if (moveOutRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `This request has already been ${moveOutRequest.status}.` },
        { status: 409 },
      )
    }

    // Update the move-out request
    moveOutRequest.status = status
    moveOutRequest.adminNotes = adminNotes
    moveOutRequest.reviewedBy = session.user.id as unknown as typeof moveOutRequest.reviewedBy
    moveOutRequest.reviewedAt = new Date()
    await moveOutRequest.save()

    // If denied and lease was already flipped to pending_moveout (Storable-
    // parity auto-approve at submit), revert it back to active.
    if (status === 'denied') {
      const lease = await Lease.findById(moveOutRequest.leaseId)
      if (lease && lease.status === 'pending_moveout') {
        lease.status = 'active'
        lease.moveOutDate = undefined
        await lease.save()
        await Unit.findByIdAndUpdate(moveOutRequest.unitId, { status: 'occupied' })
      }
    }

    // If approved, cascade updates to the related Lease and Unit
    if (status === 'approved') {
      await Lease.findByIdAndUpdate(moveOutRequest.leaseId, {
        status: 'pending_moveout',
        moveOutDate: moveOutRequest.requestedMoveOutDate,
      })

      await Unit.findByIdAndUpdate(moveOutRequest.unitId, {
        status: 'reserved',
      })

      // Auto-send "Scheduled Move Out" — fires only when the requested date
      // is in the future (Storable's contract for this template).
      const requested = moveOutRequest.requestedMoveOutDate
      if (requested && new Date(requested).getTime() > Date.now()) {
        const tenant = await Tenant.findById(moveOutRequest.tenantId)
        const unit = await Unit.findById(moveOutRequest.unitId).lean() as any
        if (tenant) {
          await sendTemplatedNotification({
            templateName: 'Scheduled Move Out',
            notificationType: 'custom',
            tenant: tenant as any,
            unitNumber: unit?.unitNumber,
            unitSize: unit?.size,
            dueDate: new Date(requested),
          })
        }
      }

      // TODO: trigger waiting list notification flow — check if any waiting list
      // entries match this unit's size/type and notify the next eligible entry
    }

    const updated = await MoveOutRequest.findById(id)
      .populate('tenantId', 'firstName lastName email')
      .populate('leaseId')
      .populate('unitId')

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
