/**
 * Lists tenants with an active lease whose billing history hasn't been re-fed
 * from storEDGE yet (no rows with importSource storable-historical:*) — the
 * remaining feed backlog, with their current (likely garbage) status/balance.
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const leases = await db.collection('leases').find({ status: { $in: ['active', 'pending_moveout'] } }).toArray()
  const unitsById = new Map(
    (await db.collection('units').find({}).project({ unitNumber: 1 }).toArray()).map((u) => [String(u._id), u.unitNumber]),
  )
  const byTenant = new Map<string, string[]>()
  for (const l of leases) {
    const k = String(l.tenantId)
    byTenant.set(k, [...(byTenant.get(k) ?? []), unitsById.get(String(l.unitId)) ?? '?'])
  }

  let fed = 0
  const pending: string[] = []
  for (const [id, units] of byTenant) {
    const t = await db.collection('tenants').findOne({ _id: new mongoose.Types.ObjectId(id) })
    if (!t || t.archived) continue
    const hasFed = await db.collection('payments').findOne({
      tenantId: t._id,
      importSource: { $regex: '^storable-historical' },
    })
    if (hasFed) { fed++; continue }
    pending.push(
      `${(t.firstName + ' ' + t.lastName).padEnd(28)} <${t.email}> units=[${units.join(', ')}] status=${t.status} balance=$${((t.balance ?? 0) / 100).toFixed(2)}`,
    )
  }

  console.log(`Tenants con lease activo : ${byTenant.size}`)
  console.log(`Ya feedeados             : ${fed}`)
  console.log(`PENDIENTES               : ${pending.length}\n`)
  pending.sort().forEach((p) => console.log('  ' + p))
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
