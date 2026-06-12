/**
 * End-to-end storEDGE billing-history feeder.
 *
 * Input: a raw text file — line 1 is the customer email, the rest is the
 * billing-history paste exactly as copied from storEDGE (newest first).
 *
 * What it does, in order:
 *   1. Parses every block (invoices, payments, credits, refunds, failed
 *      payments) into normalized rows and computes the running balance.
 *   2. Writes data/billing-history/<slug>.json as the audit artifact, with
 *      computed vs. displayed balance per row so drift is visible.
 *   3. (--apply) Wipes the tenant's existing Payment rows, bulk-inserts the
 *      new ones (timestamps staggered within each day so newest-first display
 *      matches storEDGE order), then fixes the lease(s) from the history
 *      itself (startDate, monthlyRate incl. promo, billingDay, deposit) and —
 *      when the final balance is ≤ 0 — clears spurious delinquency state
 *      (status, lockedOutAt, lease auction fields).
 *   4. Re-runs the delinquency cron's "period covered" check and prints it.
 *
 * Balance conventions (storEDGE-exact):
 *   charge +amount · approved payment −amount · FAILED/refund 0 ·
 *   "credit without payment" (grant) −amount · "credit" (application of
 *   existing credit to invoices) 0 — allocation only, no balance change.
 *
 * Run:
 *   npm run feed:billing -- data/billing-history/raw/<name>.txt          (dry)
 *   npm run feed:billing -- data/billing-history/raw/<name>.txt --apply
 */
import fs from 'fs'
import path from 'path'
import mongoose, { Types } from 'mongoose'
import { balanceDelta } from '../lib/paymentBalance'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'))
const APPLY = process.argv.includes('--apply')
if (!fileArg || !fs.existsSync(fileArg)) {
  console.error('Usage: npm run feed:billing -- <paste.txt> [--apply]')
  process.exit(1)
}

// ── helpers ──────────────────────────────────────────────────────────────────
const MONEY_RE = /-?\(?\$[\d,]+\.\d{2}\)?/g
function cents(token: string): number {
  const neg = token.includes('-') || token.includes('(')
  const n = Math.round(parseFloat(token.replace(/[^0-9.]/g, '')) * 100)
  return neg ? -n : n
}
function fmt(c: number): string {
  return `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toFixed(2)}`
}
function parseUSDate(s: string): Date {
  const [m, d, y] = s.split('/').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 8, 0, 0))
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d); r.setUTCMonth(r.getUTCMonth() + n); return r
}

type RowType = 'rent' | 'late_fee' | 'deposit' | 'prorated' | 'credit' | 'other'
type RowStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'voided'

interface ParsedRow {
  date: string
  storableId: string
  kind: 'charge' | 'payment' | 'credit_grant' | 'credit_application' | 'refund' | 'void'
  type: RowType
  status: RowStatus
  direction: 'charge' | 'payment'
  amount: number
  description: string
  dueDate?: string
  periodStart?: string
  periodEnd?: string
  displayedBalance?: number
  unitHints: string[]
}

// ── 1. Parse the paste ───────────────────────────────────────────────────────
const rawText = fs.readFileSync(fileArg, 'utf8').replace(/^﻿/, '')
const allLines = rawText.split(/\r?\n/).map((l) => l.trim())
const nonEmpty = allLines.filter((l) => l !== '')
const email = nonEmpty[0].toLowerCase()
if (!email.includes('@')) { console.error(`First line must be the customer email, got: "${nonEmpty[0]}"`); process.exit(1) }

const SEPARATORS = new Set(['Transactions', 'Line items', 'Refunds', 'REFUND'])
const BLOCK_START = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d+)(?:\s+(.+))?$/

// Group lines into blocks
interface RawBlock { date: string; id: string; inlineTitle?: string; lines: string[] }
const blocks: RawBlock[] = []
let cur: RawBlock | null = null
for (const line of nonEmpty.slice(1)) {
  if (SEPARATORS.has(line)) {
    // "REFUND" trailer belongs to the current refund block — keep as marker
    if (line === 'REFUND' && cur) cur.lines.push('REFUND')
    continue
  }
  const m = line.match(BLOCK_START)
  if (m) {
    if (cur) blocks.push(cur)
    cur = { date: m[1], id: m[2], inlineTitle: m[3]?.trim() || undefined, lines: [] }
  } else if (cur) {
    cur.lines.push(line)
  } else {
    console.error(`Unexpected line before first block: "${line}"`)
  }
}
if (cur) blocks.push(cur)

function extractPeriod(text: string): { periodStart?: string; periodEnd?: string } {
  let m = text.match(/period starting (\d{1,2}\/\d{1,2}\/\d{4})/)
  if (m) {
    const start = parseUSDate(m[1])
    const end = addMonths(start, 1)
    return { periodStart: m[1], periodEnd: `${end.getUTCMonth() + 1}/${end.getUTCDate()}/${end.getUTCFullYear()}` }
  }
  m = text.match(/for (\d{1,2}\/\d{1,2}\/\d{4}) to (\d{1,2}\/\d{1,2}\/\d{4})/)
  if (m) return { periodStart: m[1], periodEnd: m[2] }
  return {}
}
function unitHints(text: string): string[] {
  // storEDGE writes both "Unit D13" and "for unit D13 rent"
  return [...text.matchAll(/unit ([A-Za-z]?\d+[A-Za-z]?)\b/gi)].map((m) => m[1])
}
function chargeType(title: string, desc: string): RowType {
  if (/deposit/i.test(title)) return 'deposit'
  if (/prorated/i.test(title) && /rent/i.test(desc)) return 'prorated'
  if (/late|past due/i.test(title)) return 'late_fee'
  if (/protection/i.test(title)) return 'other'
  if (/rent/i.test(title)) return /prorated rent/i.test(desc) ? 'prorated' : 'rent'
  return 'other'
}

const unparsed: string[] = []
const parsed: ParsedRow[] = []

for (const b of blocks) {
  const moneyLines = b.lines.filter((l) => (l.match(MONEY_RE) || []).length > 0)

  // Charges ("X invoiced.") and refunds carry their title on the date line;
  // payment/credit blocks have a bare date line with the title on the next.
  const title = b.inlineTitle ?? b.lines[0] ?? ''
  const body = b.inlineTitle ? b.lines : b.lines.slice(1)

  // ── refund block ──
  if (/refund of/i.test(title) && title.match(MONEY_RE)) {
    const amtTok = title.match(MONEY_RE)![0]
    const note = body.find((l) => !l.match(MONEY_RE) && l !== 'REFUND') ?? ''
    parsed.push({
      date: b.date, storableId: b.id, kind: 'refund', type: 'other', status: 'refunded',
      direction: 'payment', amount: cents(amtTok),
      description: `${title.replace(MONEY_RE, '').trim()}${note ? ` — ${note}` : ''}`,
      unitHints: unitHints(note),
    })
    continue
  }

  // ── invoice / charge ──
  if (/invoiced\.?$/i.test(title)) {
    const dueDate = body.find((l) => l.startsWith('Due date:'))?.replace('Due date:', '').trim()
    const desc = body.find((l) => !l.startsWith('Due date:') && !(l.match(MONEY_RE) || []).length) ?? title
    const pair = [...((body.find((l) => (l.match(MONEY_RE) || []).length >= 2) ?? '').match(MONEY_RE) || [])]
    if (pair.length < 2) { unparsed.push(`${b.date} ${b.id} ${title} (no amount/balance pair)`); continue }
    parsed.push({
      date: b.date, storableId: b.id, kind: 'charge',
      type: chargeType(title, desc), status: 'succeeded', direction: 'charge',
      amount: cents(pair[0]), displayedBalance: cents(pair[1]),
      description: desc, dueDate, ...extractPeriod(desc), unitHints: unitHints(desc),
    })
    continue
  }

  // ── void block (cancels a posted charge; lib/paymentBalance convention:
  // the charge row stays, the void row offsets it with direction payment +
  // status voided) ──
  if (/^Void:?$/i.test(title)) {
    // A void can cancel several charges at once — one "Canceled $X of …"
    // line each; the void's amount is their sum.
    const canceledLines = body.filter((l) => /^Canceled /.test(l))
    const amounts = canceledLines.map((l) => l.match(MONEY_RE)?.[0]).filter(Boolean) as string[]
    if (!amounts.length) { unparsed.push(`${b.date} ${b.id} Void (no Canceled line)`); continue }
    const notes = body.find((l) => l.startsWith('Notes:'))?.replace('Notes:', '').trim()
    const balTok = [...moneyLines].reverse().find((l) => l.startsWith('VOID'))?.match(MONEY_RE)?.[0]
    parsed.push({
      date: b.date, storableId: b.id, kind: 'void', type: 'other', status: 'voided',
      direction: 'payment', amount: amounts.reduce((s, a) => s + cents(a), 0),
      description: `Void — ${canceledLines.join('; ')}${notes ? ` — Notes: ${notes}` : ''}`,
      displayedBalance: balTok !== undefined ? cents(balTok) : undefined,
      unitHints: unitHints(canceledLines.join(' ')),
    })
    continue
  }

  // ── payment / credit transactions (amount in title) ──
  const titleAmt = title.match(MONEY_RE)?.[0]
  const isPayment = /payment by (.+?):/.test(title)
  const isGrant = /credit without payment:/i.test(title)
  const isApplication = !isGrant && /credit:/i.test(title)
  if (!titleAmt || (!isPayment && !isGrant && !isApplication)) {
    unparsed.push(`${b.date} ${b.id} ${title}`)
    continue
  }

  const paidLines = body.filter((l) => /^(Paid|Added) /.test(l))
  const notes = body.find((l) => l.startsWith('Notes:'))?.replace('Notes:', '').trim()
  const message = body.find((l) => l.startsWith('Message:'))?.replace('Message:', '').trim()
  const failed = body.some((l) => l.startsWith('FAILED')) || /declined|insufficient|error/i.test(message ?? '')

  // Balance-after: last money-bearing line that isn't a "$X refunded" annotation;
  // its LAST money token is the displayed balance. A lone token equal to the
  // amount (echo line in FAILED/application blocks) is only trusted when no
  // better line follows it — taking the last line handles every observed shape.
  const balanceLine = [...moneyLines].reverse().find((l) => !/refunded$/.test(l))
  const balTokens = balanceLine ? [...(balanceLine.match(MONEY_RE) || [])] : []
  let displayedBalance: number | undefined
  if (balTokens.length >= 2) displayedBalance = cents(balTokens[balTokens.length - 1])
  else if (balTokens.length === 1 && (balanceLine!.startsWith('FAILED') || cents(balTokens[0]) !== cents(titleAmt))) {
    displayedBalance = cents(balTokens[0])
  }

  const method = title.match(/payment by (.+?):/)?.[1]
  const kind = isPayment ? 'payment' : isGrant ? 'credit_grant' : 'credit_application'
  const descParts = [
    isPayment ? method : isGrant ? 'Credit without payment' : 'Credit applied',
    paidLines.join('; ') || undefined,
    notes ? `Notes: ${notes}` : undefined,
    // Keep non-trivial messages: decline reasons, money-order numbers, etc.
    message && message !== 'Approved' ? message : undefined,
  ].filter(Boolean)

  // Period: prefer the first "Paid … period starting …" line (later refined to
  // the assigned unit at DB time via unitHints ordering).
  const periodLine = paidLines.find((l) => /period starting|\d{1,2}\/\d{1,2}\/\d{4} to /.test(l))

  parsed.push({
    date: b.date, storableId: b.id, kind,
    type: isPayment ? 'rent' : 'credit',
    status: failed ? 'failed' : 'succeeded',
    direction: 'payment',
    amount: cents(titleAmt),
    description: descParts.join(' — '),
    displayedBalance,
    ...(periodLine ? extractPeriod(periodLine) : {}),
    unitHints: unitHints(paidLines.join(' ')),
  })
}

// ── 2. Compute running balance oldest→newest and validate ───────────────────
const rows = [...parsed].reverse()
function balanceEffect(r: ParsedRow): number {
  if (r.direction === 'charge') return r.amount
  if (r.status === 'failed' || r.status === 'refunded') return 0
  if (r.kind === 'credit_application') return 0
  return -r.amount
}
let running = 0
const mismatches: string[] = []
const audit = rows.map((r) => {
  running += balanceEffect(r)
  if (r.displayedBalance !== undefined && r.displayedBalance !== running) {
    mismatches.push(`  ${r.date} ${r.storableId} [${r.kind}] ${fmt(r.amount)}: computed ${fmt(running)} vs displayed ${fmt(r.displayedBalance)}`)
  }
  return { ...r, balanceEffect: balanceEffect(r), computedBalanceAfter: running }
})
const finalBalance = running

const slug = path.basename(fileArg).replace(/\.[^.]+$/, '')
const jsonPath = path.resolve('data/billing-history', `${slug}.json`)
fs.writeFileSync(jsonPath, JSON.stringify({ email, finalBalance, rows: audit.map(({ unitHints: _u, kind: _k, ...r }) => r) }, null, 2))

console.log(`Email          : ${email}`)
console.log(`Blocks parsed  : ${parsed.length} (${rows.filter((r) => r.kind === 'charge').length} charges, ${rows.filter((r) => r.kind === 'payment').length} payments, ${rows.filter((r) => r.kind.startsWith('credit')).length} credits, ${rows.filter((r) => r.kind === 'refund').length} refunds, ${rows.filter((r) => r.kind === 'void').length} voids)`)
console.log(`Date range     : ${rows[0]?.date} → ${rows[rows.length - 1]?.date}`)
console.log(`Final balance  : ${fmt(finalBalance)}`)
console.log(`Audit JSON     : ${jsonPath}`)
if (unparsed.length) {
  console.log(`\n⚠ UNPARSED BLOCKS (${unparsed.length}) — fix the parser before applying:`)
  unparsed.forEach((u) => console.log('  ' + u))
}
if (mismatches.length) {
  console.log(`\n⚠ Balance mismatches vs storEDGE display (${mismatches.length}):`)
  mismatches.forEach((m) => console.log(m))
} else {
  console.log('Balance check  : every row matches the storEDGE displayed balance ✔')
}
if (unparsed.length && APPLY) { console.error('\nRefusing to --apply with unparsed blocks.'); process.exit(1) }

// ── 3. Apply to DB ───────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const tenant = await db.collection('tenants').findOne({ email })
  if (!tenant) { console.error(`Tenant ${email} not found`); process.exit(1) }

  const activeLeases = await db.collection('leases').find({ tenantId: tenant._id, status: { $in: ['active', 'pending_moveout'] } }).toArray()
  if (!activeLeases.length) { console.error('No active lease for tenant'); process.exit(1) }
  // The delinquency cron evaluates ONE lease per tenant (Lease.findOne in
  // natural order) — multi-unit payment rows must hang off that same lease or
  // the cron won't see the period as paid. Mirror its query exactly.
  const cronLease = await db.collection('leases').findOne({ tenantId: tenant._id, status: 'active' }) ?? activeLeases[0]
  const leaseUnits = await Promise.all(activeLeases.map(async (l) => ({
    lease: l,
    unit: await db.collection('units').findOne({ _id: l.unitId }),
  })))
  const byUnitNumber = new Map(leaseUnits.map((lu) => [String(lu.unit?.unitNumber), lu]))
  const defaultLU = leaseUnits[0]
  console.log(`\nTenant: ${tenant.firstName} ${tenant.lastName} (${tenant._id}) status=${tenant.status} balance=${fmt(tenant.balance ?? 0)}`)
  console.log(`Active lease(s): ${leaseUnits.map((lu) => `Unit ${lu.unit?.unitNumber} @ ${fmt(lu.lease.monthlyRate)}/mo billingDay=${lu.lease.billingDay}`).join(' | ')}`)

  // Per-active-unit fixes derived from the history itself
  const fixes = leaseUnits.map(({ lease, unit }) => {
    const un = String(unit?.unitNumber)
    const unitRows = audit.filter((r) => r.unitHints.includes(un))
    const rentCharges = unitRows.filter((r) => r.kind === 'charge' && (r.type === 'rent') && r.periodStart)
    const latestRent = rentCharges[rentCharges.length - 1]
    const promo = latestRent ? cents(latestRent.description.match(/Promotional savings of (-?\$[\d,]+\.\d{2})/)?.[1] ?? '$0.00') : 0
    const deposit = unitRows.find((r) => r.kind === 'charge' && r.type === 'deposit')
    const firstRow = unitRows[0]
    return {
      lease, unitNumber: un,
      monthlyRate: latestRent ? latestRent.amount + promo : undefined,
      billingDay: latestRent ? Math.min(parseUSDate(latestRent.periodStart!).getUTCDate(), 28) : undefined,
      startDate: firstRow ? parseUSDate(firstRow.date) : undefined,
      deposit: deposit?.amount,
    }
  })
  for (const f of fixes) {
    console.log(`Lease fix Unit ${f.unitNumber}: rate=${f.monthlyRate ? fmt(f.monthlyRate) : 'keep'} billingDay=${f.billingDay ?? 'keep'} start=${f.startDate?.toISOString().slice(0, 10) ?? 'keep'} deposit=${f.deposit ? fmt(f.deposit) : 'keep'}${finalBalance <= 0 ? ' + clear auction' : ''}`)
  }
  console.log(`Tenant fix: balance=${fmt(finalBalance)}${finalBalance <= 0 ? ", status=active, clear lockedOutAt" : ' (positive — status left as-is)'}`)

  if (!APPLY) {
    console.log('\nDry run — re-run with --apply to write.')
    await mongoose.disconnect()
    return
  }

  // Wipe + bulk insert (timestamps staggered per day, paste order preserved).
  //
  // Credit APPLICATIONS are not imported: GET /api/tenants/[id]/balance is the
  // app's source of truth and recomputes the balance from every row via
  // balanceDelta, where any succeeded credit row subtracts. In storEDGE an
  // application is allocation-only — the payment that added the credit already
  // subtracted, and the prepaid invoice charge already adds — so importing the
  // application row double-counts the credit (Bob Neland surfaced as -$290).
  const importable = audit.filter((r) => r.kind !== 'credit_application')
  if (importable.length < audit.length) {
    console.log(`Skipping ${audit.length - importable.length} credit-application row(s) — allocation-only, already netted by invoice + credit rows.`)
  }
  const importSource = `storable-historical:${slug}`
  const minuteWithinDay = new Map<string, number>()
  const docs = importable.map((r) => {
    const idx = minuteWithinDay.get(r.date) ?? 0
    minuteWithinDay.set(r.date, idx + 1)
    const createdAt = new Date(parseUSDate(r.date).getTime() + idx * 60_000)
    // Charges attach to their own unit's lease; payment-side rows touching
    // several active units (or none) attach to the cron's lease (see above).
    const hinted = [...new Set(r.unitHints)].map((u) => byUnitNumber.get(u)).filter(Boolean) as typeof leaseUnits
    const lu = r.direction === 'payment' && hinted.length !== 1
      ? leaseUnits.find((x) => String(x.lease._id) === String(cronLease._id)) ?? defaultLU
      : hinted[0] ?? defaultLU
    return {
      tenantId: tenant._id as Types.ObjectId,
      leaseId: lu.lease._id as Types.ObjectId,
      unitId: lu.lease.unitId as Types.ObjectId,
      stripePaymentIntentId: `storable_${r.storableId}`,
      amount: r.amount,
      currency: 'usd',
      type: r.type,
      status: r.status,
      direction: r.direction,
      balanceAfter: r.computedBalanceAfter,
      attemptCount: 1,
      lastAttemptAt: createdAt,
      description: r.description,
      importSource,
      ...(r.periodStart ? { periodStart: parseUSDate(r.periodStart) } : {}),
      ...(r.periodEnd ? { periodEnd: parseUSDate(r.periodEnd) } : {}),
      ...(r.dueDate ? { dueDate: parseUSDate(r.dueDate) } : {}),
      createdAt,
      updatedAt: createdAt,
    }
  })

  // Guard: GET /api/tenants/[id]/balance recomputes from rows via
  // balanceDelta and persists the result — our rows must reproduce the
  // storEDGE final balance under that exact convention or the app will
  // silently rewrite tenant.balance the first time someone opens the page.
  const ledgerSum = docs.reduce(
    (s, d) => s + balanceDelta({ direction: d.direction as 'charge' | 'payment', status: d.status as never, amount: d.amount }),
    0,
  )
  if (ledgerSum !== finalBalance) {
    console.error(`✘ Ledger mismatch: the app's recompute would give ${fmt(ledgerSum)} but storEDGE final is ${fmt(finalBalance)}. Refusing to apply.`)
    process.exit(1)
  }

  const wipe = await db.collection('payments').deleteMany({ tenantId: tenant._id })
  const ins = await db.collection('payments').insertMany(docs)
  console.log(`\nWiped ${wipe.deletedCount} old rows, inserted ${ins.insertedCount}.`)

  const now = new Date()
  for (const f of fixes) {
    await db.collection('leases').updateOne(
      { _id: f.lease._id },
      {
        $set: {
          ...(f.monthlyRate !== undefined ? { monthlyRate: f.monthlyRate } : {}),
          ...(f.billingDay !== undefined ? { billingDay: f.billingDay } : {}),
          ...(f.startDate ? { startDate: f.startDate, createdAt: f.startDate } : {}),
          ...(f.deposit !== undefined ? { deposit: f.deposit } : {}),
          updatedAt: now,
        },
        ...(finalBalance <= 0 ? { $unset: { auctionDate: 1, auctionScheduledAt: 1 } } : {}),
      },
    )
  }
  await db.collection('tenants').updateOne(
    { _id: tenant._id },
    {
      $set: { balance: finalBalance, updatedAt: now, ...(finalBalance <= 0 ? { status: 'active' } : {}) },
      ...(finalBalance <= 0 ? { $unset: { lockedOutAt: 1 } } : {}),
    },
  )
  console.log('Lease + tenant fixes applied.')

  // ── 4. Verify against the delinquency cron's check ──
  for (const { lease, unit } of leaseUnits) {
    const nowD = new Date()
    const freshLease = await db.collection('leases').findOne({ _id: lease._id })
    const bd = freshLease!.billingDay
    const thisMonth = new Date(nowD.getFullYear(), nowD.getMonth(), Math.min(bd, 28))
    const lastBilling = thisMonth <= nowD ? thisMonth : new Date(nowD.getFullYear(), nowD.getMonth() - 1, bd)
    const lastPayment = await db.collection('payments')
      .find({ tenantId: tenant._id, leaseId: lease._id, type: 'rent', status: 'succeeded' })
      .sort({ periodStart: -1 }).limit(1).next()
    const covered = lastPayment?.periodStart && lastPayment.periodStart >= new Date(lastBilling.getFullYear(), lastBilling.getMonth(), 1)
    const isCronLease = String(lease._id) === String(cronLease._id)
    console.log(`Delinquency check Unit ${unit?.unitNumber}${isCronLease ? ' (lease the cron evaluates)' : ' (not evaluated by cron)'}: lastBilling=${lastBilling.toDateString()}, lastPayment.periodStart=${lastPayment?.periodStart?.toISOString()?.slice(0, 10) ?? 'NONE'} → ${covered ? 'covered ✔' : isCronLease ? '⚠ NOT COVERED — cron will escalate' : 'n/a'}`)
  }

  await mongoose.disconnect()
  console.log('\nDone.')
}
main().catch((e) => { console.error(e); process.exit(1) })
