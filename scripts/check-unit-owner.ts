import mongoose from 'mongoose'
const URI = process.env.MONGODB_URI!
async function main() {
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  const re = /lorenzana|silvio/i
  const tenants = await db.collection('tenants').find({ $or: [{ firstName: re }, { lastName: re }, { email: re }] }).toArray()
  for (const t of tenants) {
    console.log(`TENANT ${t._id} | ${t.firstName} ${t.lastName} | ${t.email} | bal ${t.balance} | status ${t.status} | lockedOutAt=${t.lockedOutAt ?? '-'}`)
    const leases = await db.collection('leases').find({ tenantId: t._id }).toArray()
    for (const l of leases) {
      const u = await db.collection('units').findOne({ _id: l.unitId })
      console.log(`  lease ${l._id} unit=${u?.unitNumber} status=${l.status} rate=${l.monthlyRate} auctionDate=${l.auctionDate ?? '-'}`)
    }
    const pays = await db.collection('payments').countDocuments({ tenantId: t._id })
    console.log(`  payment rows: ${pays}`)
  }
  await mongoose.disconnect()
}
main().catch((e)=>{console.error(e);process.exit(1)})
