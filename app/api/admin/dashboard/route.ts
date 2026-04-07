import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Tenant from '@/models/Tenant'
import Payment from '@/models/Payment'
import Lease from '@/models/Lease'
import WaitingList from '@/models/WaitingList'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [
      totalUnits,
      occupiedUnits,
      availableUnits,
      delinquentCount,
      lockedOutCount,
      revenueResult,
      activeTenantCount,
      autopayEnabledCount,
      waitingListCount,
      upcomingMoveOuts,
    ] = await Promise.all([
      Unit.countDocuments({}),
      Unit.countDocuments({ status: 'occupied' }),
      Unit.countDocuments({ status: 'available' }),
      Tenant.countDocuments({ status: 'delinquent' }),
      Tenant.countDocuments({ status: 'locked_out' }),
      Payment.aggregate([
        {
          $match: {
            status: 'succeeded',
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Tenant.countDocuments({ status: 'active' }),
      Tenant.countDocuments({ status: 'active', autopayEnabled: true }),
      WaitingList.countDocuments({ status: 'waiting' }),
      Lease.countDocuments({
        moveOutDate: { $gte: now, $lte: thirtyDaysFromNow },
        status: { $in: ['active', 'pending_moveout'] },
      }),
    ])

    const totalRevenue = revenueResult.length > 0 ? (revenueResult[0] as { total: number }).total : 0
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 10000) / 100 : 0
    const recurringBillingRate = activeTenantCount > 0
      ? Math.round((autopayEnabledCount / activeTenantCount) * 10000) / 100
      : 0

    return NextResponse.json({
      success: true,
      data: {
        occupancyRate,
        totalRevenue,
        availableUnits,
        delinquentCount,
        lockedOutCount,
        recurringBillingRate,
        waitingListCount,
        upcomingMoveOuts,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
