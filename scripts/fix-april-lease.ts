/**
 * One-off: align April Marlow's B14 lease with the storEDGE reality and undo
 * the spurious delinquency escalation the cron applied to her brand-new
 * account (no periodStart on payments → flagged late → locked out + auction).
 *
 *   - startDate 6/5/2026, billingDay 5
 *   - monthlyRate $125.00 (storEDGE: $62.50 paid = half of $125 move-in promo)
 *   - clear auctionDate/auctionScheduledAt
 *   - tenant back to active, lockedOutAt cleared
 *
 * Run: npx tsx --env-file=.env.local scripts/fix-april-lease.ts
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const TENANT_ID = '6a2b9db5b3c657029a85c51b'
const LEASE_ID = '6a2b9db9b3c657029a85c522'

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const now = new Date()
  const startDate = new Date(Date.UTC(2026, 5, 5, 12, 0, 0))

  const leaseRes = await db.collection('leases').updateOne(
    { _id: new mongoose.Types.ObjectId(LEASE_ID) },
    {
      $set: { startDate, billingDay: 5, monthlyRate: 12500, deposit: 12000, createdAt: startDate, updatedAt: now },
      $unset: { auctionDate: 1, auctionScheduledAt: 1 },
    },
  )
  console.log(`lease updated: ${leaseRes.modifiedCount}`)

  const tenantRes = await db.collection('tenants').updateOne(
    { _id: new mongoose.Types.ObjectId(TENANT_ID) },
    { $set: { status: 'active', updatedAt: now }, $unset: { lockedOutAt: 1 } },
  )
  console.log(`tenant updated: ${tenantRes.modifiedCount}`)

  const lease = await db.collection('leases').findOne({ _id: new mongoose.Types.ObjectId(LEASE_ID) })
  const tenant = await db.collection('tenants').findOne(
    { _id: new mongoose.Types.ObjectId(TENANT_ID) },
    { projection: { firstName: 1, lastName: 1, status: 1, balance: 1, lockedOutAt: 1 } },
  )
  console.log('LEASE:', JSON.stringify(lease))
  console.log('TENANT:', JSON.stringify(tenant))
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
