import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import LockoutEvent from '@/models/LockoutEvent'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

// GET /api/admin/lockout-events?status=pending|approved&from=&to=
// Backs Storable's Lock Out Report. Default returns last 30 days of events
// (both pending + approved) so the admin can scan the recent activity log.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const status = req.nextUrl.searchParams.get('status')
    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')

    const filter: Record<string, unknown> = {}
    if (status === 'pending') filter.approvedAt = null
    else if (status === 'approved') filter.approvedAt = { $ne: null }
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.$gte = new Date(from)
      if (to) range.$lte = new Date(to)
      filter.createdAt = range
    } else {
      // Default 30-day window.
      filter.createdAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }

    const rows = await LockoutEvent.find(filter)
      .populate('tenantId', 'firstName lastName email')
      .populate('unitId', 'unitNumber')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
