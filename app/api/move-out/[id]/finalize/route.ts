import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import MoveOutRequest from '@/models/MoveOutRequest'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Tenant from '@/models/Tenant'
import Payment from '@/models/Payment'
import { sendTemplatedNotification } from '@/lib/sendNotification'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/move-out/[id]/finalize
// Admin executes the move-out: end lease, free unit, stop autopay, notify tenant.
// Distinct from PATCH (which approves the plan).
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const request = await MoveOutRequest.findById(id)
    if (!request) {
      return NextResponse.json({ success: false, error: 'Move-out request not found' }, { status: 404 })
    }
    if (request.status !== 'approved') {
      return NextResponse.json(
        { success: false, error: 'Request must be approved before finalizing' },
        { status: 409 },
      )
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

    // Free unit
    await Unit.findByIdAndUpdate(request.unitId, {
      status: 'available',
      $unset: { currentTenantId: '', currentLeaseId: '' },
    })

    // Stop autopay — billing must not continue past move-out
    const tenant = await Tenant.findByIdAndUpdate(
      request.tenantId,
      { autopayEnabled: false },
      { new: true },
    )

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

    // Get unit number for the receipt
    const unit = (await Unit.findById(request.unitId).select('unitNumber').lean()) as
      | { unitNumber?: string }
      | null

    // Send move-out receipt to tenant
    if (tenant) {
      await sendTemplatedNotification({
        templateName: 'Move Out Receipt',
        notificationType: 'move_out_confirmation',
        tenant,
        unitNumber: unit?.unitNumber,
        balance: finalBalance,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        leaseId: lease._id.toString(),
        unitId: request.unitId.toString(),
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
