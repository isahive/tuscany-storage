/**
 * Delete the spurious late/past-due fee rows the delinquency cron generated
 * while running against an incomplete billing ledger during pre-launch prep.
 *
 * Targets ONLY cron-generated fee rows, identified by their idempotency-token
 * prefix (`latelienfee:` for per-event fees, `late_fee_` for the main late
 * step) AND a null importSource. Imported Storable history (`storable_*`,
 * importSource `storable-historical:*`) and manual admin fees (NSF, cut-lock,
 * spid undefined) are left untouched.
 *
 * Dry-run by default. Pass --commit to actually delete.
 * After committing, run scripts/backfill-balance-after.ts to recompute
 * balanceAfter + tenant.balance from the cleaned ledger.
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }
const COMMIT = process.argv.includes('--commit')

const FILTER = {
  $or: [
    { stripePaymentIntentId: { $regex: '^latelienfee:' } },
    { stripePaymentIntentId: { $regex: '^late_fee_' } },
  ],
  importSource: null, // guard — never touch imported/manual rows
}

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const P = db.collection('payments')
  const fmt = (d: any) => (d ? new Date(d).toISOString().slice(0, 16) : '—')

  const rows = await P.find(FILTER as any).sort({ createdAt: 1 }).toArray()
  let sum = 0
  console.log(`${COMMIT ? '[COMMIT]' : '[DRY-RUN]'} matched ${rows.length} spurious cron fee rows:\n`)
  for (const r of rows) {
    sum += r.amount
    const t = await db.collection('tenants').findOne({ _id: r.tenantId })
    const nm = t ? `${t.firstName} ${t.lastName}`.trim() : '?'
    console.log(`  ${nm.padEnd(22)} ${String(r.type).padEnd(9)} ${String(r.status).padEnd(9)} $${(r.amount / 100).toFixed(2).padStart(7)}  created=${fmt(r.createdAt)}  spid=${String(r.stripePaymentIntentId).slice(0, 30)}`)
  }
  console.log(`\n  Total: ${rows.length} rows, $${(sum / 100).toFixed(2)}`)

  if (!COMMIT) {
    console.log('\nDry-run only. Re-run with --commit to delete, then run backfill-balance-after.ts.')
    await mongoose.disconnect()
    return
  }

  const res = await P.deleteMany(FILTER as any)
  console.log(`\n✔ Deleted ${res.deletedCount} rows.`)
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
