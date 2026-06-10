/**
 * Preview how many active leases would have their `billingDay` mutated if the
 * admin switched the facility's billing cycle anchor to a given value. Used by
 * the rental settings UI to render a "this will update N leases — continue?"
 * confirmation dialog before the destructive Settings PUT.
 *
 * Read-only — never writes. Computes the delta in-memory using the same
 * `computeBillingDay` rule the PUT path will apply.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import { computeBillingDay } from '@/lib/billing/billingDay'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

const ANCHORS = new Set(['first_of_month', 'signup_day', 'custom_day'])

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const anchor = url.searchParams.get('anchor') ?? ''
  const customDayRaw = url.searchParams.get('customDay') ?? '1'
  if (!ANCHORS.has(anchor)) {
    return NextResponse.json(
      { success: false, error: 'invalid anchor (must be first_of_month, signup_day, or custom_day)' },
      { status: 400 },
    )
  }
  const customDay = Number.parseInt(customDayRaw, 10)
  if (!Number.isFinite(customDay) || customDay < 1 || customDay > 28) {
    return NextResponse.json(
      { success: false, error: 'invalid customDay (must be 1..28)' },
      { status: 400 },
    )
  }

  await connectDB()

  const leases = await Lease.find({ status: 'active' }).select('billingDay startDate')
  let wouldChange = 0
  for (const lease of leases) {
    const current = (lease as any).billingDay as number
    const target = computeBillingDay(
      { billingCycleAnchor: anchor as any, billingCycleCustomDay: customDay },
      (lease as any).startDate ?? new Date(),
    )
    if (current !== target) wouldChange++
  }

  return NextResponse.json({
    success: true,
    data: { scanned: leases.length, wouldChange },
  })
}
