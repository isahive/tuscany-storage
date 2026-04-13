import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'

// GET /api/portal/balance
// Returns the tenant's current period balance: monthlyRate minus succeeded payments this month.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const lease = await Lease.findOne({ tenantId: session.user.id, status: { $in: ['active', 'pending_moveout'] } })
    if (!lease) {
      return NextResponse.json({ success: false, error: 'No active lease found' }, { status: 404 })
    }

    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    // Sum of succeeded payments this billing period
    const payments = await Payment.find({
      tenantId: session.user.id,
      leaseId: lease._id,
      status: 'succeeded',
      periodStart: { $gte: periodStart },
      periodEnd:   { $lte: periodEnd },
    })

    const paid = payments.reduce((sum, p) => sum + p.amount, 0)
    const balance = Math.max(0, lease.monthlyRate - paid)

    // Due date: billingDay of current month (or next month if already past)
    const billingDay = lease.billingDay ?? 1
    let dueDate = new Date(now.getFullYear(), now.getMonth(), billingDay)
    if (dueDate < now) {
      dueDate = new Date(now.getFullYear(), now.getMonth() + 1, billingDay)
    }

    return NextResponse.json({
      success: true,
      data: {
        monthlyRate: lease.monthlyRate,
        paid,
        balance,
        dueDate: dueDate.toISOString(),
        leaseId: lease._id,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
