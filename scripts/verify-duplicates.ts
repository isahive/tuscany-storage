/**
 * One-off: run the same duplicate scan as GET /api/admin/tenants/duplicates
 * against live data and print the pairs the admin panel will show.
 */
import mongoose from 'mongoose'
import { findDuplicates, type TenantForMatch } from '../lib/tenantDuplicates'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const tenants = await db.collection('tenants')
    .find({ archived: { $ne: true }, isRetailWalkIn: { $ne: true } })
    .project({ firstName: 1, lastName: 1, email: 1, phone: 1, address: 1, zip: 1, billingAddress: 1, cardFingerprint: 1, linkedTenantIds: 1, dismissedMatchIds: 1 })
    .toArray()

  const projected: TenantForMatch[] = tenants.map((t) => ({
    id: String(t._id),
    firstName: t.firstName,
    lastName: t.lastName,
    email: t.email,
    phone: t.phone,
    address: t.address,
    zip: t.zip,
    billingAddress: t.billingAddress,
    cardFingerprint: t.cardFingerprint,
    linkedTenantIds: (t.linkedTenantIds || []).map(String),
    dismissedMatchIds: (t.dismissedMatchIds || []).map(String),
  }))

  const matches = findDuplicates(projected)
  const byId = new Map(projected.map((t) => [t.id, t]))
  const seen = new Set<string>()
  console.log(`Scanned ${projected.length} tenants.\nPairs the duplicates panel will show:`)
  for (const m of matches) {
    const key = [m.tenantId, m.otherId].sort().join('::')
    if (seen.has(key)) continue
    seen.add(key)
    const a = byId.get(m.tenantId)!
    const b = byId.get(m.otherId)!
    console.log(`  [${m.confidence}] ${a.firstName} ${a.lastName} <${a.email}>  ↔  ${b.firstName} ${b.lastName} <${b.email}>  (${m.reasons.join(', ')})`)
  }
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
