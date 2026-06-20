import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Payment from '@/models/Payment'
import { priorBalanceAfter, balanceDelta } from '@/lib/paymentBalance'
import { withCronLock, isLockSkipped } from '@/lib/cronLock'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/recurring-billing
 *
 * Runs the recurring-billing sweep:
 *   - Iterates active leases
 *   - For each, computes the next billing date (lease.billingDay + tenant.billingDateOffset)
 *   - If due today (or before) AND no successful payment for the current period exists yet:
 *       - Charges the tenant's default payment method off-session via Stripe
 *       - Records a Payment row
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}` (or `?secret=`).
 *       In dev without a secret, runs without auth but still requires explicit "dryRun=false".
 *
 * Body (optional):
 *   { date?: string (YYYY-MM-DD), dryRun?: boolean, tenantId?: string }
 */

// Vercel function limit — the sweep iterates every active lease with
// off-session Stripe charges. Requires Fluid compute (300s on all plans).
export const maxDuration = 300

interface ChargeResult {
  leaseId: string
  tenantName: string
  unit: string
  amount: number
  status: 'charged' | 'skipped' | 'failed' | 'preview'
  reason?: string
  paymentIntentId?: string
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // dev mode — allow without secret
  const header = req.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  const url = new URL(req.url)
  if (url.searchParams.get('secret') === secret) return true
  return false
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Period for a given billing day — assumes monthly cycle anchored on billingDay. */
function periodFor(today: Date, billingDay: number, offsetDays: number) {
  const due = new Date(today.getFullYear(), today.getMonth(), Math.min(billingDay, 28))
  const charge = new Date(due)
  charge.setDate(charge.getDate() + offsetDays)
  // If today is before charge date, period applies to prior month
  if (today < startOfDay(charge)) {
    due.setMonth(due.getMonth() - 1)
    charge.setMonth(charge.getMonth() - 1)
  }
  const periodStart = new Date(due)
  const periodEnd = new Date(due)
  periodEnd.setMonth(periodEnd.getMonth() + 1)
  periodEnd.setDate(periodEnd.getDate() - 1)
  return { dueDate: due, chargeDate: charge, periodStart, periodEnd }
}

async function processLease(
  lease: any,
  tenant: any,
  unit: any,
  today: Date,
  dryRun: boolean
): Promise<ChargeResult> {
  const tenantName = `${tenant.firstName} ${tenant.lastName}`
  const unitNum = unit?.unitNumber ?? '?'
  const skip = (reason: string): ChargeResult => ({
    leaseId: String(lease._id), tenantName, unit: unitNum, amount: 0, status: 'skipped', reason,
  })

  if (lease.status !== 'active') return skip(`lease not active (${lease.status})`)
  if (!tenant.autopayEnabled) return skip('autopay paused')
  if (!tenant.defaultPaymentMethodId || !tenant.stripeCustomerId) return skip('no payment method on file')

  const offset = tenant.billingDateOffset ?? 0
  const { dueDate, chargeDate, periodStart, periodEnd } = periodFor(today, lease.billingDay, offset)

  if (startOfDay(today) < startOfDay(chargeDate)) {
    return skip(`not due yet (charge ${chargeDate.toISOString().slice(0, 10)})`)
  }

  // Skip if we already have a succeeded/pending payment for this period
  const existing = await Payment.findOne({
    leaseId: lease._id,
    type: 'rent',
    periodStart: { $lte: dueDate },
    periodEnd: { $gte: dueDate },
    status: { $in: ['succeeded', 'pending'] },
  }).lean()
  if (existing) return skip('period already charged')

  const amount = lease.monthlyRate

  if (dryRun) {
    return {
      leaseId: String(lease._id), tenantName, unit: unitNum, amount,
      status: 'preview',
      reason: `would charge ${amount / 100} on ${chargeDate.toISOString().slice(0, 10)}`,
    }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return skip('Stripe not configured')
  }

  // ── Atomically claim this lease+period BEFORE touching Stripe ──
  // The sparse unique index on billingPeriodKey makes a second overlapping
  // sweep (or an in-flight retry) fail this insert and skip, rather than issue
  // a duplicate Stripe charge. The claim is committed standalone — NOT inside a
  // transaction — precisely so a concurrent run can see it immediately.
  const billingPeriodKey = `${lease._id}:${dueDate.toISOString().slice(0, 10)}:rent`
  const prior = await priorBalanceAfter(Payment, tenant._id)

  let claim
  try {
    claim = await Payment.create({
      tenantId: tenant._id,
      leaseId: lease._id,
      unitId: unit._id,
      amount,
      currency: 'usd',
      type: 'rent',
      status: 'pending',
      direction: 'payment',
      billingPeriodKey,
      balanceAfter: prior, // neutral until the charge resolves below
      periodStart,
      periodEnd,
      attemptCount: 0,
    })
  } catch (err: any) {
    if (err?.code === 11000) return skip('period already claimed (concurrent run)')
    throw err
  }

  const { stripe } = await import('@/lib/stripe')

  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: tenant.stripeCustomerId,
      payment_method: tenant.defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      payment_method_types: ['card'],
      metadata: {
        tenantId: String(tenant._id),
        leaseId: String(lease._id),
        unitId: String(unit._id),
        type: 'rent',
        period: dueDate.toISOString().slice(0, 10),
      },
    })

    const status = intent.status === 'succeeded' ? 'succeeded' : 'pending'
    claim.status = status
    claim.stripePaymentIntentId = intent.id
    claim.stripeChargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : undefined
    claim.balanceAfter = prior + balanceDelta({ direction: 'payment', status, amount })
    claim.attemptCount = 1
    claim.lastAttemptAt = today
    await claim.save()

    return {
      leaseId: String(lease._id), tenantName, unit: unitNum, amount,
      status: intent.status === 'succeeded' ? 'charged' : 'failed',
      reason: intent.status,
      paymentIntentId: intent.id,
    }
  } catch (err: any) {
    // Charge failed — keep the row for billing history, but release the period
    // (clear billingPeriodKey) so the next sweep can retry. Failed rows don't
    // move the balance, so balanceAfter stays at `prior`.
    claim.status = 'failed'
    claim.stripePaymentIntentId = err?.payment_intent?.id ?? `failed_${today.getTime()}`
    claim.balanceAfter = prior
    claim.attemptCount = 1
    claim.lastAttemptAt = today
    claim.failureReason = err?.message ?? 'Stripe error'
    claim.billingPeriodKey = undefined
    await claim.save()
    return {
      leaseId: String(lease._id), tenantName, unit: unitNum, amount,
      status: 'failed',
      reason: err?.message ?? 'Stripe error',
    }
  }
}

async function runSweep(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: any = {}
  try { body = await req.json() } catch { /* empty body ok */ }

  const today = body.date ? new Date(body.date) : new Date()
  const dryRun = body.dryRun === true
  const onlyTenantId: string | undefined = body.tenantId

  await connectDB()

  // A dry run does no writes, so it's safe to let it run alongside a live sweep.
  // A live sweep takes the lock so two overlapping invocations can't double-charge.
  if (dryRun) return runSweepInner(today, dryRun, onlyTenantId)

  const result = await withCronLock('recurring-billing', () =>
    runSweepInner(today, dryRun, onlyTenantId),
  )
  if (isLockSkipped(result)) {
    return NextResponse.json(
      { success: true, summary: { skipped: 'another billing run is in progress' } },
      { status: 200 },
    )
  }
  return result
}

async function runSweepInner(today: Date, dryRun: boolean, onlyTenantId: string | undefined): Promise<NextResponse> {
  const leaseFilter: Record<string, unknown> = { status: 'active' }
  if (onlyTenantId) leaseFilter.tenantId = onlyTenantId

  const leases = await Lease.find(leaseFilter).lean()
  const tenantIds = [...new Set(leases.map((l: any) => String(l.tenantId)))]
  const unitIds = [...new Set(leases.map((l: any) => String(l.unitId)))]

  const tenants = await Tenant.find({ _id: { $in: tenantIds } })
    .select('+stripeCustomerId +defaultPaymentMethodId')
    .lean()
  const units = await Unit.find({ _id: { $in: unitIds } }).lean()

  const tenantMap = new Map(tenants.map((t: any) => [String(t._id), t]))
  const unitMap = new Map(units.map((u: any) => [String(u._id), u]))

  const results: ChargeResult[] = []
  for (const lease of leases) {
    const tenant = tenantMap.get(String(lease.tenantId))
    const unit = unitMap.get(String(lease.unitId))
    if (!tenant || !unit) continue
    results.push(await processLease(lease, tenant, unit, today, dryRun))
  }

  const summary = {
    date: today.toISOString().slice(0, 10),
    dryRun,
    total: results.length,
    charged: results.filter((r) => r.status === 'charged').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    previewed: results.filter((r) => r.status === 'preview').length,
  }

  return NextResponse.json({ success: true, summary, results })
}

export async function POST(req: NextRequest) {
  return runSweep(req)
}

// Also allow GET so Vercel's scheduled GETs work
export async function GET(req: NextRequest) {
  return runSweep(req)
}
