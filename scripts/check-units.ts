/**
 * One-off: inspect specific units flagged by the crossmatch audit —
 * who holds them via units.currentTenantId vs active leases.
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const UNITS = ['B14', 'D9', 'G3', 'D1', 'C18', 'H5', 'A14', 'A23', 'A24', 'G5']

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  for (const unitNumber of UNITS) {
    const u = await db.collection('units').findOne({ unitNumber })
    if (!u) { console.log(`${unitNumber}: UNIT NOT FOUND`); continue }
    const curTenant = u.currentTenantId
      ? await db.collection('tenants').findOne({ _id: u.currentTenantId }, { projection: { firstName: 1, lastName: 1, email: 1, status: 1 } })
      : null
    const leases = await db.collection('leases').find({ unitId: u._id, status: { $in: ['active', 'pending_moveout'] } }).toArray()
    const leaseTenants = await Promise.all(leases.map(async (l) => {
      const t = await db.collection('tenants').findOne({ _id: new mongoose.Types.ObjectId(String(l.tenantId)) }, { projection: { firstName: 1, lastName: 1, email: 1, status: 1 } })
      return `${l.status} lease ${l._id} → ${t ? `${t.firstName} ${t.lastName} <${t.email}> (${t.status})` : 'TENANT MISSING ' + l.tenantId}`
    }))
    console.log(`\n${unitNumber} (status=${u.status}):`)
    console.log(`  currentTenantId → ${curTenant ? `${curTenant.firstName} ${curTenant.lastName} <${curTenant.email}> (${curTenant.status})` : u.currentTenantId ? 'TENANT MISSING ' + u.currentTenantId : 'none'}`)
    for (const lt of leaseTenants) console.log(`  ${lt}`)
    if (!leaseTenants.length) console.log('  (no active leases)')
  }
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
