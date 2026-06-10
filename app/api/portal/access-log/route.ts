import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import AccessLog from '@/models/AccessLog'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

// GET /api/portal/access-log
// Query params: eventType, startDate, endDate, limit, skip
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const eventType = searchParams.get('eventType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
    const skip = parseInt(searchParams.get('skip') ?? '0', 10)

    const filter: Record<string, unknown> = { tenantId: session.user.id }
    if (eventType && ['entry', 'exit', 'denied', 'code_changed'].includes(eventType)) {
      filter.eventType = eventType
    }
    if (startDate || endDate) {
      const range: Record<string, Date> = {}
      if (startDate) range.$gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        range.$lte = end
      }
      filter.createdAt = range
    }

    const [logs, total] = await Promise.all([
      AccessLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AccessLog.countDocuments(filter),
    ])

    return NextResponse.json({
      success: true,
      data: {
        logs: logs.map((l) => ({
          _id: l._id.toString(),
          eventType: l.eventType,
          gateId: l.gateId,
          source: l.source,
          notes: l.notes ?? null,
          createdAt: l.createdAt,
        })),
        total,
        limit,
        skip,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
