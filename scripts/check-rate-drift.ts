/**
 * One-off: for every fed customer, compare the corrected lease.monthlyRate
 * (what the invoice + autopay crons actually bill) against the stale
 * unit.price still on the units collection. Surfaces any drift so we can
 * decide whether unit.price needs syncing too.
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const fed = await db.collection('payments').distinct('tenantId', { importSource: { $regex: '^storable-historical' } })
  const unitsById = new Map(
    (await db.collection('units').find({}).project({ unitNumber: 1, price: 1 }).toArray()).map((u) => [String(u._id), u]),
  )
  let drift = 0, ok = 0
  const rows: string[] = []
  for (const tid of fed) {
    const leases = await db.collection('leases').find({ tenantId: tid, status: { $in: ['active', 'pending_moveout'] } }).toArray()
    for (const l of leases) {
      const u = unitsById.get(String(l.unitId))
      if (!u) continue
      if ((u.price ?? 0) !== (l.monthlyRate ?? 0)) {
        drift++
        rows.push(`  Unit ${String(u.unitNumber).padEnd(5)} lease.monthlyRate=$${((l.monthlyRate ?? 0) / 100).toFixed(2).padStart(7)}  unit.price=$${((u.price ?? 0) / 100).toFixed(2).padStart(7)}  ← DRIFT`)
      } else ok++
    }
  }
  console.log(`Fed tenants: ${fed.length} | active leases checked: ${drift + ok}`)
  console.log(`lease.monthlyRate == unit.price : ${ok}`)
  console.log(`DRIFT (unit.price stale)        : ${drift}\n`)
  rows.sort().forEach((r) => console.log(r))
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
