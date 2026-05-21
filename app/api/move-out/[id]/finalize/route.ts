import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import MoveOutRequest from '@/models/MoveOutRequest'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Tenant from '@/models/Tenant'
import Payment from '@/models/Payment'
import { revokeGateAccess } from '@/lib/gateAccess'

interface RouteContext {
  params: Promise<{ id: string }>
}

const finalizeSchema = z.object({
  unitStatusAfter: z.enum(['available', 'maintenance', 'reserved', 'unavailable']).optional(),
  archiveCustomer: z.boolean().optional(),
})

// POST /api/move-out/[id]/finalize
// Admin executes the move-out: end lease, free unit, stop autopay, notify tenant.
// Storable-parity: requests are auto-approved at submit, so this also
// transitions pending → approved if needed.
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    let body: { unitStatusAfter?: string; archiveCustomer?: boolean } = {}
    try { body = await req.json() } catch { /* empty body is allowed */ }
    const parsed = finalizeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }
    const unitStatusAfter = parsed.data.unitStatusAfter ?? 'available'
    const archiveCustomer = parsed.data.archiveCustomer ?? false

    await connectDB()

    const request = await MoveOutRequest.findById(id)
    if (!request) {
      return NextResponse.json({ success: false, error: 'Move-out request not found' }, { status: 404 })
    }
    if (request.status === 'denied') {
      return NextResponse.json(
        { success: false, error: 'Request was denied — cannot finalize' },
        { status: 409 },
      )
    }
    if (request.status === 'pending') {
      request.status = 'approved'
      request.reviewedBy = session.user.id as unknown as typeof request.reviewedBy
      request.reviewedAt = new Date()
      await request.save()
    }

    const lease = await Lease.findById(request.leaseId)
    if (!lease) {
      return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })
    }
    if (lease.status === 'ended') {
      return NextResponse.json({ success: false, error: 'Lease already ended' }, { status: 409 })
    }

    const now = new Date()

    // End lease
    lease.status = 'ended'
    lease.endDate = now
    lease.moveOutDate = now
    await lease.save()

    // Free unit (with admin-selected status)
    await Unit.findByIdAndUpdate(request.unitId, {
      status: unitStatusAfter,
      $unset: { currentTenantId: '', currentLeaseId: '' },
    })

    // Stop autopay + flip status — billing and gate access end at move-out.
    // Optionally archive the customer per admin choice.
    const tenantUpdate: Record<string, unknown> = {
      autopayEnabled: false,
      status: 'moved_out',
    }
    if (archiveCustomer) tenantUpdate.archived = true
    const tenant = await Tenant.findByIdAndUpdate(request.tenantId, tenantUpdate, { new: true })

    // Wipe gate code, additional cards, gate groups + audit-log the revocation
    await revokeGateAccess(request.tenantId, 'move_out', request.unitId)

    // Cancel any pending payments for this lease (not yet captured)
    await Payment.updateMany(
      { leaseId: lease._id, status: 'pending' },
      { $set: { status: 'failed', failureReason: 'Lease ended at move-out' } },
    )

    // Compute outstanding balance (sum of pending/failed amounts owed)
    const owed = await Payment.aggregate([
      {
        $match: {
          tenantId: request.tenantId,
          leaseId: lease._id,
          status: { $in: ['failed', 'pending'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    const owedTotal: number = owed[0]?.total ?? 0

    // Proration credit: if the most recent succeeded rent payment covers days past move-out,
    // refund the unused portion as a credit.
    const lastRent = await Payment.findOne({
      tenantId: request.tenantId,
      leaseId: lease._id,
      type: 'rent',
      status: 'succeeded',
    }).sort({ periodStart: -1 })

    let prorationCredit = 0
    if (lastRent && lastRent.periodEnd > now) {
      const periodMs = lastRent.periodEnd.getTime() - lastRent.periodStart.getTime()
      const unusedMs = lastRent.periodEnd.getTime() - now.getTime()
      if (periodMs > 0 && unusedMs > 0) {
        prorationCredit = Math.round((lastRent.amount * unusedMs) / periodMs)
        // Record the credit as a negative-amount Payment for audit trail
        await Payment.create({
          tenantId: request.tenantId,
          leaseId: lease._id,
          unitId: request.unitId,
          stripePaymentIntentId: `proration_credit_${Date.now()}_${request.tenantId}`,
          amount: -prorationCredit,
          currency: 'usd',
          type: 'prorated',
          status: 'pending',
          periodStart: now,
          periodEnd: lastRent.periodEnd,
          attemptCount: 0,
          failureReason: 'Move-out proration credit — manual refund required',
        })
      }
    }

    const finalBalance = owedTotal - prorationCredit

    // Get unit number for the receipt — admin previews and explicitly sends
    // from the receipt page, so no auto-send here.
    const unit = (await Unit.findById(request.unitId).select('unitNumber').lean()) as
      | { unitNumber?: string }
      | null
    void tenant

    return NextResponse.json({
      success: true,
      data: {
        leaseId: lease._id.toString(),
        unitId: request.unitId.toString(),
        unitNumber: unit?.unitNumber ?? '',
        tenantId: request.tenantId.toString(),
        owedTotal,
        prorationCredit,
        finalBalance,
        movedOutAt: now,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
