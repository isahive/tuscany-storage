import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Payment from '@/models/Payment'

/**
 * GET /api/portal/dashboard
 *
 * Returns everything the portal dashboard page renders in a single call:
 *   - tenant contact info + lockout flag
 *   - balance breakdown (outstanding / credit / balance)
 *   - one row per active lease, with all the fields shown on the live
 *     Current Rentals card (price, status, moved-in, next bill, deposit,
 *     protection, agreement-signed flag)
 *   - latest billing history rows for the bottom card
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    void Unit // ensure model is registered before populate

    const tenant = await Tenant.findById(session.user.id)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const leases = await Lease.find({
      tenantId: session.user.id,
      status: { $in: ['active', 'pending_moveout'] },
    }).populate('unitId')

    // ── Balance breakdown (matches the live "Outstanding / Credit / Balance") ──
    // The signed `tenant.balance` is the source of truth: positive = owed,
    // negative = credit on file. We split it into the two columns the live
    // portal shows.
    const balanceCents = tenant.balance ?? 0
    const outstanding = balanceCents > 0 ? balanceCents : 0
    const credit = balanceCents < 0 ? -balanceCents : 0

    // ── Per-lease rental rows ──
    const now = new Date()
    const rentals = leases.map((lease: any) => {
      const unit = lease.unitId
      const billingDay = lease.billingDay ?? 1
      let nextBill = new Date(now.getFullYear(), now.getMonth(), billingDay)
      if (nextBill <= now) {
        nextBill = new Date(now.getFullYear(), now.getMonth() + 1, billingDay)
      }
      return {
        leaseId: lease._id.toString(),
        unitId: unit?._id?.toString() ?? null,
        unitNumber: unit?.unitNumber ?? '',
        size: unit?.size ?? '',
        monthlyRate: lease.monthlyRate,
        status: lease.status,
        movedInAt: lease.startDate.toISOString(),
        moveOutDate: lease.moveOutDate ? new Date(lease.moveOutDate).toISOString() : null,
        nextBillAt: nextBill.toISOString(),
        deposit: lease.deposit ?? 0,
        protectionPlanId: lease.protectionPlanId?.toString() ?? null,
        agreementSigned: !!lease.signedAt,
        signedAt: lease.signedAt ? new Date(lease.signedAt).toISOString() : null,
      }
    })

    // ── Latest billing history for the bottom card (newest first, top 3) ──
    const recentPayments = await Payment.find({ tenantId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean() as any[]

    const billingHistory = recentPayments.map((p) => ({
      _id: p._id.toString(),
      createdAt: p.createdAt.toISOString(),
      type: p.type,
      direction: p.direction,
      status: p.status,
      amount: p.amount,
      description: p.description ?? '',
      balanceAfter: p.balanceAfter ?? 0,
      periodStart: p.periodStart ? new Date(p.periodStart).toISOString() : null,
      periodEnd: p.periodEnd ? new Date(p.periodEnd).toISOString() : null,
      dueDate: p.dueDate ? new Date(p.dueDate).toISOString() : null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        contact: {
          firstName: tenant.firstName,
          lastName: tenant.lastName,
          fullName: `${tenant.firstName} ${tenant.lastName}`,
          email: tenant.email,
          phone: tenant.phone,
          address: tenant.address ?? '',
          city: tenant.city ?? '',
          state: tenant.state ?? '',
          zip: tenant.zip ?? '',
        },
        status: tenant.status,
        lockedOut: tenant.status === 'locked_out',
        gateCode: tenant.gateCode ?? '',
        balance: {
          outstanding,
          credit,
          balance: balanceCents,
        },
        rentals,
        billingHistory,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
