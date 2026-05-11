import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import RateChange from '@/models/RateChange'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import { sendTemplatedNotification } from '@/lib/sendNotification'

interface RouteContext {
  params: Promise<{ id: string }>
}

const schema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().optional(),
})

// PATCH /api/admin/rate-management/[id] — approve or reject a rate change proposal
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }
    const { status, rejectionReason } = parsed.data

    await connectDB()

    const change = await RateChange.findById(id)
    if (!change) {
      return NextResponse.json({ success: false, error: 'Rate change not found' }, { status: 404 })
    }
    if (change.status !== 'proposed') {
      return NextResponse.json(
        { success: false, error: `This proposal has already been ${change.status}.` },
        { status: 409 },
      )
    }

    change.status = status
    change.approvedBy = session.user.id as unknown as typeof change.approvedBy
    change.approvedAt = new Date()
    if (status === 'rejected' && rejectionReason) change.rejectionReason = rejectionReason

    if (status === 'approved') {
      // Send 30-day notice to tenant via "Rate Change Notice" template (created if missing)
      const tenant = await Tenant.findById(change.tenantId)
      const unit = await Unit.findById(change.unitId).select('unitNumber').lean() as
        | { unitNumber?: string }
        | null
      if (tenant) {
        await sendTemplatedNotification({
          templateName: 'Rate Change Notice',
          notificationType: 'rate_change_notice',
          tenant,
          unitNumber: unit?.unitNumber,
          monthlyRate: change.proposedRate,
          dueDate: change.effectiveDate,
        })
        change.noticeSentAt = new Date()
      }
    }

    await change.save()
    return NextResponse.json({ success: true, data: change })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
