/**
 * Generic billing-history importer for customers migrated from Storable Easy.
 *
 * Reads `data/billing-history/<slug>.json`, wipes ALL existing Payment rows
 * for that tenant (the Storable paste is the authoritative source — earlier
 * bulk imports for the same tenant are stale and would double-count), then
 * reinserts the new rows with the correct running balance snapshots.
 *
 * Run:  npm run import:billing -- <slug>          # apply
 *       npm run import:billing -- <slug> --dry    # preview totals, no writes
 *
 * JSON shape (one file per customer):
 * {
 *   "email": "customer@example.com",
 *   "rows": [
 *     { "date": "6/24/2022", "storableId": "54233195",
 *       "type": "rent", "status": "succeeded", "direction": "charge",
 *       "amount": 8500, "description": "..." }
 *   ]
 * }
 */
import fs from 'fs'
import path from 'path'
import mongoose, { Types } from 'mongoose'
import { balanceDelta } from '../lib/paymentBalance'

type Row = {
  date: string
  storableId: string
  type: 'rent' | 'late_fee' | 'deposit' | 'prorated' | 'credit' | 'other'
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'voided'
  direction: 'charge' | 'payment'
  amount: number
  description: string
}

type File = {
  email: string
  rows: Row[]
}

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

function parseUSDate(s: string): Date {
  const [m, d, y] = s.split('/').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

function fmtUSD(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`
}

async function main() {
  const args = process.argv.slice(2)
  const slug = args.find((a) => !a.startsWith('--'))
  const dry = args.includes('--dry')

  if (!slug) {
    console.error('Usage: npm run import:billing -- <slug> [--dry]')
    process.exit(1)
  }

  const filePath = path.resolve(process.cwd(), 'data/billing-history', `${slug}.json`)
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const file = JSON.parse(fs.readFileSync(filePath, 'utf8')) as File
  if (!file.email || !Array.isArray(file.rows) || file.rows.length === 0) {
    console.error('JSON must include `email` and a non-empty `rows` array')
    process.exit(1)
  }

  const importSource = `storable-historical:${slug}`

  console.log(`\nSlug         : ${slug}`)
  console.log(`Email        : ${file.email}`)
  console.log(`Rows in file : ${file.rows.length}`)
  console.log(`Import source: ${importSource}`)
  console.log(`Mode         : ${dry ? 'DRY RUN (no writes)' : 'APPLY'}\n`)

  console.log('Connecting to MongoDB…')
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  console.log('Connected.')

  const tenant = await db.collection('tenants').findOne({
    email: { $regex: `^${file.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  })
  if (!tenant) {
    console.error(`Tenant ${file.email} not found`)
    await mongoose.disconnect()
    process.exit(1)
  }
  console.log(`Tenant: ${tenant.firstName} ${tenant.lastName} (${tenant._id})`)

  const lease = await db.collection('leases').findOne({ tenantId: tenant._id, status: 'active' })
  if (!lease) {
    console.error('No active lease for tenant')
    await mongoose.disconnect()
    process.exit(1)
  }
  console.log(`Lease : ${lease._id} — Unit ${lease.unitId} @ ${fmtUSD(lease.monthlyRate)}/mo`)

  // Walk oldest→newest so each row carries the correct balanceAfter snapshot.
  // Sort by date in case the file isn't already ordered.
  const sorted = [...file.rows].sort(
    (a, b) => parseUSDate(a.date).getTime() - parseUSDate(b.date).getTime(),
  )

  let running = 0
  const docs = sorted.map((r) => {
    const createdAt = parseUSDate(r.date)
    running += balanceDelta(r)
    return {
      tenantId: tenant._id as Types.ObjectId,
      leaseId: lease._id as Types.ObjectId,
      unitId: lease.unitId as Types.ObjectId,
      stripePaymentIntentId: `storable_${r.storableId}`,
      amount: r.amount,
      currency: 'usd',
      type: r.type,
      status: r.status,
      direction: r.direction,
      balanceAfter: running,
      attemptCount: 1,
      lastAttemptAt: createdAt,
      description: r.description,
      importSource,
      createdAt,
      updatedAt: createdAt,
    }
  })

  const chargesTotal = sorted.reduce((s, r) => s + (r.direction === 'charge' ? r.amount : 0), 0)
  const paymentsTotal = sorted.reduce(
    (s, r) => s + (r.direction === 'payment' && r.status !== 'failed' && r.status !== 'refunded' ? r.amount : 0),
    0,
  )

  console.log('\n── Preview ──────────────────────────────────────────────')
  console.log(`Charges total : ${fmtUSD(chargesTotal)}`)
  console.log(`Payments total: ${fmtUSD(paymentsTotal)}`)
  console.log(`Final balance : ${fmtUSD(running)}`)
  console.log(`First row date: ${sorted[0].date}`)
  console.log(`Last row date : ${sorted[sorted.length - 1].date}`)

  if (dry) {
    console.log('\nDry run — no writes performed.')
    await mongoose.disconnect()
    return
  }

  const wipe = await db.collection('payments').deleteMany({ tenantId: tenant._id })
  console.log(`\nWiped ${wipe.deletedCount} prior payment rows for this tenant (full reset).`)

  const insert = await db.collection('payments').insertMany(docs)
  console.log(`Inserted ${insert.insertedCount} payment rows.`)

  await db.collection('tenants').updateOne({ _id: tenant._id }, { $set: { balance: running } })
  console.log(`Updated tenant.balance → ${fmtUSD(running)}`)

  await mongoose.disconnect()
  console.log('\nDone.')
}

main().catch(async (err) => {
  console.error(err)
  try {
    await mongoose.disconnect()
  } catch {}
  process.exit(1)
})
