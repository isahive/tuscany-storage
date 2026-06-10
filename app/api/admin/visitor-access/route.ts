/**
 * Admin endpoints for VisitorAccess (temporary contractor passes).
 *
 * GET  — list passes filtered by status. Default last-7-days window so the
 *        page loads fast on busy facilities.
 * POST — issue a new pass. Returns the PIN exactly ONCE — subsequent GETs
 *        omit it (security: PIN visibility is limited to the moment of
 *        creation, after which the operator should have shared it).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import VisitorAccess from '@/models/VisitorAccess'
import {
  issueVisitorAccess,
  VisitorAccessValidationError,
} from '@/lib/visitorAccessService'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set(['active', 'expired', 'revoked'])

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
    if (status && VALID_STATUSES.has(status)) filter.status = status
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.$gte = new Date(from)
      if (to) range.$lte = new Date(to)
      filter.createdAt = range
    } else {
      // Default 7-day window — temporary passes are short-lived; older rows
      // are an audit concern, not a daily-ops one.
      filter.createdAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }

    // Hide the PIN on list reads. Audit-related fields (createdBy, revokedBy)
    // are kept so the admin can see who touched each row.
    const rows = await VisitorAccess.find(filter)
      .select('-pin')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

interface IssuePayload {
  name?: unknown
  purpose?: unknown
  durationMinutes?: unknown
  validFrom?: unknown
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = (await req.json().catch(() => ({}))) as IssuePayload
    const name = asString(body.name)
    const purpose = asString(body.purpose)
    const durationMinutes = Number(body.durationMinutes)
    const validFrom = body.validFrom ? new Date(asString(body.validFrom)) : undefined

    const createdBy = session.user.email ?? session.user.name ?? 'admin'

    const issued = await issueVisitorAccess({
      name,
      purpose,
      durationMinutes,
      createdBy,
      validFrom,
    })

    return NextResponse.json({ success: true, data: issued })
  } catch (error) {
    if (error instanceof VisitorAccessValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
