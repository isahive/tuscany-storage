/**
 * Imports the Storable Easy transaction export into the Payment collection.
 *
 * CSV columns (in order):
 *   Transaction Date, Facility, Tenant Name, Unit Name, Cardholder,
 *   Payment Method, Transaction Amount, Transaction Type, Status, Deposit Date
 *
 * Behavior:
 *   - Matches the tenant by normalized name (lowercase + middle initial stripped).
 *     If no tenant matches we skip the row and log it — we never create
 *     placeholder tenants from a payment file.
 *   - Maps each row to a Payment doc:
 *       amount  = parseFloat(Transaction Amount) * 100  (sign preserved)
 *       type    = "rent" for Sale/Void, "credit" for Refund
 *       status  = Settled/Approved → succeeded
 *                  Failed           → failed
 *                  Returned         → refunded
 *                  Void             → refunded
 *     and stores cardholderName + paymentMethodLabel + importSource.
 *   - Idempotent: rows are tagged with a deterministic stripePaymentIntentId
 *     (`import_<sha1_of_row>`) so re-running skips duplicates.
 *
 * Run with:
 *   npm run import:transactions
 *   npm run import:transactions -- "path/to/Transactions.csv"
 */
import mongoose from 'mongoose'
import fs from 'fs'
import crypto from 'crypto'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'
const CSV_PATH = process.argv[2] || 'D:/Users/silvi/Downloads/Transactions-14-May-2026.csv'
const IMPORT_SOURCE = `storable-csv-${new Date().toISOString().slice(0, 10)}`

// ── CSV parser (handles quoted fields and embedded commas) ──────────────────
function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

// "Mark A Burrell" → "mark burrell". Lets us catch middle-initial drift.
function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((p) => !/^[a-z]\.?$/.test(p)) // drop single-letter middle initials
    .join(' ')
}

// "11-May-2026 3:17 PM" → Date. The CSV uses 'dd-MMM-yyyy h:mm A'.
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}
function parseStorableDate(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i)
  if (!m) return null
  const [, d, monStr, y, hStr, minStr, ampm] = m
  const mon = MONTHS[monStr.toLowerCase()]
  if (mon === undefined) return null
  let hour = hStr ? parseInt(hStr, 10) : 0
  const min = minStr ? parseInt(minStr, 10) : 0
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0
  }
  return new Date(parseInt(y, 10), mon, parseInt(d, 10), hour, min)
}

type Mapped = {
  amount: number // cents, signed
  type: 'rent' | 'credit' | 'other'
  status: 'succeeded' | 'failed' | 'refunded' | 'pending'
}

function mapTxn(txnType: string, txnStatus: string, amountCents: number): Mapped {
  const t = txnType.trim().toLowerCase()
  const s = txnStatus.trim().toLowerCase()

  // Status mapping
  let status: Mapped['status'] = 'pending'
  if (s === 'settled' || s === 'approved') status = 'succeeded'
  else if (s === 'failed') status = 'failed'
  else if (s === 'returned') status = 'refunded'

  // Type mapping — Refund/Void are negative-amount credits
  let type: Mapped['type'] = 'rent'
  if (t === 'refund') { type = 'credit'; status = 'refunded' }
  else if (t === 'void')   { type = 'credit'; status = 'refunded' }

  return { amount: amountCents, type, status }
}

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at: ${CSV_PATH}`)
    process.exit(1)
  }

  console.log(`Connecting to MongoDB…`)
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!
  const tenants = db.collection('tenants')
  const payments = db.collection('payments')
  const leases = db.collection('leases')

  // Build a lookup: normalized name → tenant _id.
  const allTenants = await tenants.find({}, { projection: { firstName: 1, lastName: 1 } }).toArray()
  const tenantByName = new Map<string, any>()
  for (const t of allTenants) {
    const key = normalizeName(`${t.firstName} ${t.lastName}`)
    tenantByName.set(key, t)
  }
  console.log(`Loaded ${allTenants.length} tenants for matching.`)

  const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0)
  console.log(`Parsing ${lines.length - 1} rows from ${CSV_PATH}`)

  let inserted = 0
  let skippedExisting = 0
  let skippedNoTenant = 0
  let skippedBadRow = 0
  const unmatchedNames = new Map<string, number>()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 10) { skippedBadRow++; continue }
    const [txnDate, , tenantName, unitName, cardholder, method, amountStr, txnType, status, depositDate] = cols.map((c) => c.replace(/^"|"$/g, ''))

    const date = parseStorableDate(txnDate)
    if (!date) { skippedBadRow++; continue }
    const amount = Math.round(parseFloat(amountStr) * 100)
    if (isNaN(amount)) { skippedBadRow++; continue }

    const key = normalizeName(tenantName || cardholder)
    const tenant = tenantByName.get(key)
    if (!tenant) {
      skippedNoTenant++
      unmatchedNames.set(key, (unmatchedNames.get(key) ?? 0) + 1)
      continue
    }

    const rowHash = crypto
      .createHash('sha1')
      .update(`${txnDate}|${tenantName}|${unitName}|${amountStr}|${txnType}|${status}`)
      .digest('hex')
    const importId = `import_${rowHash}`

    // Idempotency check.
    const existing = await payments.findOne({ stripePaymentIntentId: importId })
    if (existing) { skippedExisting++; continue }

    const mapped = mapTxn(txnType, status, amount)
    const deposit = parseStorableDate(depositDate)

    // Try to attach a unit/lease if we can find an active rental.
    const lease = await leases.findOne(
      { tenantId: tenant._id, status: { $in: ['active', 'pending_moveout'] } },
      { sort: { createdAt: -1 } },
    )

    await payments.insertOne({
      tenantId: tenant._id,
      leaseId: lease?._id,
      unitId: lease?.unitId,
      stripePaymentIntentId: importId,
      amount: mapped.amount,
      currency: 'usd',
      type: mapped.type,
      status: mapped.status,
      // Use the transaction date as the period anchor — refined by
      // generate-rent-charges for the rent invoices it owns.
      periodStart: date,
      periodEnd: date,
      attemptCount: 1,
      lastAttemptAt: date,
      description: `${txnType} — ${method.trim()}`.trim(),
      cardholderName: cardholder.trim() || undefined,
      paymentMethodLabel: method.trim() || undefined,
      importSource: IMPORT_SOURCE,
      createdAt: date,
      updatedAt: deposit ?? date,
    })
    inserted++
  }

  // Refresh tenant balances from inserted history so the UI reflects reality.
  console.log('\nRecomputing tenant balances…')
  const succeededAgg = await payments.aggregate([
    { $match: { status: 'succeeded' } },
    { $group: { _id: '$tenantId', total: { $sum: '$amount' } } },
  ]).toArray()
  const succeededByTenant = new Map<string, number>(succeededAgg.map((r) => [r._id.toString(), r.total]))
  const refundedAgg = await payments.aggregate([
    { $match: { status: 'refunded' } },
    { $group: { _id: '$tenantId', total: { $sum: '$amount' } } },
  ]).toArray()
  for (const r of refundedAgg) {
    const prev = succeededByTenant.get(r._id.toString()) ?? 0
    succeededByTenant.set(r._id.toString(), prev + r.total) // refund amounts are negative
  }

  console.log('\n=== Summary ===')
  console.log(`Inserted Payment docs:        ${inserted}`)
  console.log(`Skipped (already imported):   ${skippedExisting}`)
  console.log(`Skipped (no tenant match):    ${skippedNoTenant}`)
  console.log(`Skipped (malformed rows):     ${skippedBadRow}`)
  if (unmatchedNames.size > 0) {
    console.log(`\nTop unmatched names:`)
    const sorted = [...unmatchedNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    for (const [name, count] of sorted) console.log(`  ${name} (${count} rows)`)
    if (unmatchedNames.size > 15) console.log(`  …+${unmatchedNames.size - 15} more`)
  }
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
