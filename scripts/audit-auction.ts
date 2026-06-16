/**
 * READ-ONLY audit of auction state.
 *
 * "In auction today" = any ACTIVE lease with auctionDate OR auctionScheduledAt
 * set (same rule lib/unitStatus.ts uses to render the 'auction' badge).
 *
 * Replicates jobs/delinquency.ts day math + thresholds so we can re-derive
 * whether each auction-flagged lease SHOULD be there, and — inversely — whether
 * any tenant that crossed the auction threshold was NOT escalated.
 *
 * Writes nothing. Run: tsx --env-file=.env.local scripts/audit-auction.ts
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

// ── helpers copied verbatim from jobs/delinquency.ts ─────────────────────────
function getLastBillingDate(billingDay: number, now: Date): Date {
  const thisMonthBilling = new Date(now.getFullYear(), now.getMonth(), Math.min(billingDay, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()))
  if (thisMonthBilling <= now) return thisMonthBilling
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const lastDayPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate()
  return new Date(prevYear, prevMonth, Math.min(billingDay, lastDayPrevMonth))
}
function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}
function daysForStatus(events: Array<{ status: string; daysPastDue: number }> | undefined, status: string, fallback: number): number {
  return events?.find((e) => e.status === status)?.daysPastDue ?? fallback
}

const DEFAULT_LATE_DAY = 5
const DEFAULT_LOCKOUT_DAY = 10
const DEFAULT_LIEN_DAY = 45

function fmt(d?: Date | null): string {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}
function money(c?: number): string {
  const v = (c ?? 0) / 100
  return v < 0 ? `-$${Math.abs(v).toFixed(2)}` : `$${v.toFixed(2)}`
}

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const now = new Date()

  const settings = await db.collection('settings').findOne({}) as any
  const events = (settings?.lateLienEvents ?? []) as Array<{ status: string; daysPastDue: number }>
  const lateDay = settings?.lateFeeAfterDays ?? daysForStatus(events, 'late', DEFAULT_LATE_DAY)
  const fallbackLockoutDay = daysForStatus(events, 'locked_out', DEFAULT_LOCKOUT_DAY)
  const lienDay = daysForStatus(events, 'lien', DEFAULT_LIEN_DAY)
  const auctionDay = daysForStatus(events, 'auction', lienDay + 30)
  const auctionGraceDays = settings?.auctionGracePeriodDays ?? 14
  const hasAutoAuctionCfg = !!(settings?.auctionDaysAfterLockout || settings?.auctionFixedDate)

  console.log('═══ AUCTION AUDIT ═══')
  console.log(`Now: ${now.toISOString()}`)
  console.log(`Thresholds (days past due): late=${lateDay} lockout=${fallbackLockoutDay} lien=${lienDay} auction=${auctionDay} grace=${auctionGraceDays}`)
  console.log(`Auto-auction-at-lockout configured: ${hasAutoAuctionCfg} (daysAfterLockout=${settings?.auctionDaysAfterLockout ?? '—'}, fixedDate=${fmt(settings?.auctionFixedDate)})`)
  console.log('')

  const tenants = db.collection('tenants')
  const leases = db.collection('leases')
  const units = db.collection('units')

  async function ctx(lease: any) {
    const tenant = await tenants.findOne({ _id: lease.tenantId })
    const unit = lease.unitId ? await units.findOne({ _id: lease.unitId }) : null
    const billingDay = lease.billingDay ?? 1
    const lastBilling = getLastBillingDate(billingDay, now)
    const days = daysBetween(lastBilling, now)
    const balance = tenant?.balance ?? 0
    const paidUp = balance <= 0
    const newMoveIn = lease.startDate && new Date(lease.startDate) > lastBilling
    return { tenant, unit, billingDay, lastBilling, days, balance, paidUp, newMoveIn }
  }
  const name = (t: any) => t ? `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() || t.email : '<no tenant>'

  // ── SECTION A: currently flagged as auction ────────────────────────────────
  const inAuction = await leases.find({
    status: 'active',
    $or: [{ auctionDate: { $ne: null } }, { auctionScheduledAt: { $ne: null } }],
  }).toArray()

  console.log(`── A) Leases currently flagged AUCTION: ${inAuction.length} ──\n`)
  const anomalies: string[] = []

  for (const lease of inAuction) {
    const c = await ctx(lease)
    const unitNo = c.unit?.unitNumber ?? '?'
    const flags: string[] = []

    // Stale: paid up but auction date still set → cron should have cleared it.
    if (c.paidUp) flags.push('STALE: balance<=0 but auction date still set (should be cleared)')
    // Status inconsistency.
    if (c.tenant && c.tenant.status === 'active') flags.push(`STATUS MISMATCH: tenant.status='active' yet auction-flagged`)
    // Premature: not paid up, but hasn't crossed lockout nor auction day, and no
    // auto-at-lockout config that could justify an early stamp → likely manual or wrong.
    if (!c.paidUp && c.days < fallbackLockoutDay && c.days < auctionDay) {
      flags.push(`EARLY: only ${c.days}d past due (< lockout ${fallbackLockoutDay}d) — manual or premature`)
    }
    // Auto-at-lockout stamp but config not present (can't have been auto) → manual.
    if (!c.paidUp && c.days >= fallbackLockoutDay && c.days < auctionDay && !hasAutoAuctionCfg) {
      flags.push(`MANUAL?: ${c.days}d past due, below auction threshold ${auctionDay}d, no auto-config — set by admin`)
    }

    const line = `  Unit ${String(unitNo).padEnd(6)} ${name(c.tenant).padEnd(24)} bal=${money(c.balance).padStart(9)} days=${String(c.days).padStart(3)} auctionDate=${fmt(lease.auctionDate)} scheduledAt=${fmt(lease.auctionScheduledAt)} status=${c.tenant?.status ?? '?'}`
    console.log(line)
    for (const f of flags) {
      console.log(`         ⚠ ${f}`)
      anomalies.push(`Unit ${unitNo} / ${name(c.tenant)}: ${f}`)
    }
  }

  // ── SECTION B: SHOULD be in auction but isn't ──────────────────────────────
  console.log(`\n── B) Tenants past auction threshold (${auctionDay}d) WITHOUT an auction date ──\n`)
  const candidates = await tenants.find({ status: { $in: ['active', 'delinquent', 'locked_out'] }, role: 'tenant' }).toArray()
  let missed = 0
  for (const tenant of candidates) {
    const lease = await leases.findOne({ tenantId: tenant._id, status: 'active' })
    if (!lease) continue
    if (lease.auctionDate || lease.auctionScheduledAt) continue
    const c = await ctx(lease)
    if (c.paidUp || c.newMoveIn) continue
    if (c.days >= auctionDay) {
      const unit = lease.unitId ? await units.findOne({ _id: lease.unitId }) : null
      console.log(`  ⚠ Unit ${String(unit?.unitNumber ?? '?').padEnd(6)} ${name(tenant).padEnd(24)} bal=${money(c.balance).padStart(9)} days=${String(c.days).padStart(3)} status=${tenant.status} — past auction threshold, NO auction date`)
      anomalies.push(`Unit ${unit?.unitNumber ?? '?'} / ${name(tenant)}: past auction threshold (${c.days}d) but not escalated`)
      missed++
    }
  }
  if (missed === 0) console.log('  (none)')

  // ── SECTION C: orphaned auction flags on non-active leases ─────────────────
  const orphans = await leases.find({
    status: { $ne: 'active' },
    $or: [{ auctionDate: { $ne: null } }, { auctionScheduledAt: { $ne: null } }],
  }).toArray()
  console.log(`\n── C) Auction flags on non-active (moved-out/closed) leases: ${orphans.length} ──\n`)
  for (const lease of orphans) {
    const tenant = await tenants.findOne({ _id: lease.tenantId })
    const unit = lease.unitId ? await units.findOne({ _id: lease.unitId }) : null
    console.log(`  ⚠ Unit ${String(unit?.unitNumber ?? '?').padEnd(6)} ${name(tenant).padEnd(24)} leaseStatus=${lease.status} auctionDate=${fmt(lease.auctionDate)}`)
    anomalies.push(`Unit ${unit?.unitNumber ?? '?'} / ${name(tenant)}: auction flag on ${lease.status} lease (orphan)`)
  }
  if (orphans.length === 0) console.log('  (none)')

  console.log(`\n═══ SUMMARY: ${anomalies.length} anomaly(ies) across ${inAuction.length} auction-flagged + ${missed} missed + ${orphans.length} orphan ═══`)
  for (const a of anomalies) console.log(`  • ${a}`)

  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
