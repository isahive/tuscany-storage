/**
 * Clear stale auction dates left by the June 10 mass-lockout event (the
 * delinquency cron ran against an incomplete ledger and stamped auctionDate on
 * the whole roster). Nobody is anywhere near the 37-day auction threshold, so
 * every remaining flag is premature; orphan flags also linger on moved-out
 * leases. This unsets auctionDate + auctionScheduledAt on every lease that
 * still carries one. The (fixed) delinquency cron will re-stamp a real auction
 * date if a tenant genuinely reaches the threshold later.
 *
 * Does NOT touch tenant status or gate access — locked-out tenants who actually
 * owe stay locked out; the cron reconciles them when un-paused.
 *
 * Dry-run by default. Pass --commit to apply.
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }
const COMMIT = process.argv.includes('--commit')

const FILTER = { $or: [{ auctionDate: { $ne: null } }, { auctionScheduledAt: { $ne: null } }] }

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const L = db.collection('leases')
  const fmt = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '—')

  const rows = await L.find(FILTER as any).toArray()
  console.log(`${COMMIT ? '[COMMIT]' : '[DRY-RUN]'} ${rows.length} leases carry an auction flag:\n`)
  for (const l of rows) {
    const t = await db.collection('tenants').findOne({ _id: l.tenantId })
    const u = l.unitId ? await db.collection('units').findOne({ _id: l.unitId }) : null
    const nm = t ? `${t.firstName} ${t.lastName}`.trim() : '?'
    console.log(`  Unit ${String(u?.unitNumber ?? '?').padEnd(6)} ${nm.padEnd(22)} leaseStatus=${String(l.status).padEnd(9)} auctionDate=${fmt(l.auctionDate)} scheduledAt=${fmt(l.auctionScheduledAt)}`)
  }

  if (!COMMIT) {
    console.log('\nDry-run only. Re-run with --commit to clear.')
    await mongoose.disconnect()
    return
  }

  const res = await L.updateMany(FILTER as any, { $unset: { auctionDate: 1, auctionScheduledAt: 1 } })
  console.log(`\n✔ Cleared auction flags on ${res.modifiedCount} leases.`)
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
