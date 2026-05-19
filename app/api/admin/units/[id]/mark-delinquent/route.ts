import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import Tenant from '@/models/Tenant'
import { nextBalanceAfter } from '@/lib/paymentBalance'

const schema = z.object({
  /** How many days to backdate the unpaid line so the display jumps to
   *  Late (1+), Pre-Lien (30+), or Lien (60+). */
  daysUnpaid: z.number().int().min(1).max(365),
  /** Optional: also flip the tenant to status='locked_out'. */
  lockOutTenant: z.boolean().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/units/[id]/mark-delinquent
 *
 * Manually pushes a unit into Late / Pre-Lien / Lien for demo / testing
 * without waiting for cron to roll forward time. We do this by creating a
 * BACKDATED unpaid rent line on the active lease (`dueDate = now - daysUnpaid`).
 * The display-status resolver picks that up the next time the unit is read.
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
      return NextResponse.json({ success: false, error: 'No active lease — unit must be rented first' }, { status: 422 })
    }

    const tenant = await Tenant.findById(lease.tenantId)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    // Backdate the unpaid rent charge so the display status reflects the
    // chosen delinquency tier. Using `dueDate` since the resolver checks
    // `oldestUnpaid.dueDate` first.
    const now = new Date()
    const dueDate = new Date(now)
    dueDate.setDate(dueDate.getDate() - parsed.data.daysUnpaid)

    const periodStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1)
    const periodEnd = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0, 23, 59, 59)

    const amount = lease.monthlyRate
    const balanceAfter = await nextBalanceAfter(Payment, tenant._id, {
      direction: 'charge',
      status: 'pending',
      amount,
    })

    await Payment.create({
      tenantId: tenant._id,
      leaseId: lease._id,
      unitId: unit._id,
      amount,
      currency: 'usd',
      type: 'rent',
      status: 'pending',
      direction: 'charge',
      balanceAfter,
      periodStart,
      periodEnd,
      dueDate,
      description: `Backdated unpaid rent (${parsed.data.daysUnpaid} days past due)`,
      attemptCount: 0,
    })

    // Bump tenant balance + flag delinquent so admin lists pick it up.
    tenant.balance = (tenant.balance ?? 0) + amount
    if (parsed.data.lockOutTenant) {
      tenant.status = 'locked_out'
      tenant.lockedOutAt = now
    } else if (tenant.status === 'active') {
      tenant.status = 'delinquent'
    }
    await tenant.save()

    return NextResponse.json({
      success: true,
      data: {
        daysUnpaid: parsed.data.daysUnpaid,
        lockedOut: tenant.status === 'locked_out',
        balance: tenant.balance,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
