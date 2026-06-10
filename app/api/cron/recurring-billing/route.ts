import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Payment from '@/models/Payment'
import { nextBalanceAfter } from '@/lib/paymentBalance'

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
    const balanceAfter = await nextBalanceAfter(Payment, tenant._id, {
      direction: 'payment',
      status,
      amount,
    })
    await Payment.create({
      tenantId: tenant._id,
      leaseId: lease._id,
      unitId: unit._id,
      stripePaymentIntentId: intent.id,
      stripeChargeId: typeof intent.latest_charge === 'string' ? intent.latest_charge : undefined,
      amount,
      currency: 'usd',
      type: 'rent',
      status,
      direction: 'payment',
      balanceAfter,
      periodStart,
      periodEnd,
      attemptCount: 1,
      lastAttemptAt: today,
    })

    return {
      leaseId: String(lease._id), tenantName, unit: unitNum, amount,
      status: intent.status === 'succeeded' ? 'charged' : 'failed',
      reason: intent.status,
      paymentIntentId: intent.id,
    }
  } catch (err: any) {
    // Record the failure (failed rows don't move balance — delta is 0)
    const failedBalanceAfter = await nextBalanceAfter(Payment, tenant._id, {
      direction: 'payment',
      status: 'failed',
      amount,
    })
    await Payment.create({
      tenantId: tenant._id,
      leaseId: lease._id,
      unitId: unit._id,
      stripePaymentIntentId: err?.payment_intent?.id ?? `failed_${Date.now()}`,
      amount,
      currency: 'usd',
      type: 'rent',
      status: 'failed',
      direction: 'payment',
      balanceAfter: failedBalanceAfter,
      periodStart,
      periodEnd,
      attemptCount: 1,
      lastAttemptAt: today,
      failureReason: err?.message ?? 'Stripe error',
    })
    return {
      leaseId: String(lease._id), tenantName, unit: unitNum, amount,
      status: 'failed',
      reason: err?.message ?? 'Stripe error',
    }
  }
}

async function runSweep(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: any = {}
  try { body = await req.json() } catch { /* empty body ok */ }

  const today = body.date ? new Date(body.date) : new Date()
  const dryRun = body.dryRun === true
  const onlyTenantId: string | undefined = body.tenantId

  await connectDB()

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
