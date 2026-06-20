/**
 * One-off: release a spurious unit lease from a tenant (May-import artifact
 * not backed by storEDGE). Ends the lease, frees the unit, mirroring the
 * admin move-out flow but scoped to ONE unit so the tenant keeps their others.
 *
 * Usage: npx tsx --env-file=.env.local scripts/release-unit.ts <email> <unitNumber>
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }
const [email, unitNumber] = process.argv.slice(2)
if (!email || !unitNumber) { console.error('Usage: release-unit.ts <email> <unitNumber>'); process.exit(1) }

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const now = new Date()
  const tenant = await db.collection('tenants').findOne({ email })
  const unit = await db.collection('units').findOne({ unitNumber })
  if (!tenant || !unit) { console.error('tenant or unit not found'); process.exit(1) }

  const leases = await db.collection('leases').find({ tenantId: tenant._id, unitId: unit._id, status: { $in: ['active', 'pending_moveout'] } }).toArray()
  for (const l of leases) {
    await db.collection('leases').updateOne({ _id: l._id }, { $set: { status: 'ended', endDate: now, updatedAt: now } })
    console.log(`ended lease ${l._id} (${unitNumber})`)
  }
  // Free the unit only if it points at this tenant.
  const res = await db.collection('units').updateOne(
    { _id: unit._id, currentTenantId: tenant._id },
    { $set: { status: 'available', updatedAt: now }, $unset: { currentTenantId: 1, currentLeaseId: 1 } },
  )
  console.log(`unit ${unitNumber} freed: ${res.modifiedCount}`)
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
