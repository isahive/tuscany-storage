import mongoose from 'mongoose'
const URI = process.env.MONGODB_URI!
async function main() {
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  for (const q of process.argv.slice(2)) {
    const re = new RegExp(q, 'i')
    const ts = await db.collection('tenants').find({ $or: [{ lastName: re }, { firstName: re }, { email: re }] }).toArray()
    for (const t of ts) {
      const active = await db.collection('leases').findOne({ tenantId: t._id, status: 'active' })
      console.log(`${t.firstName} ${t.lastName} | ${t.email} | bal ${t.balance} | status ${t.status} | activeLease=${active? 'YES':'no'}`)
    }
    if (!ts.length) console.log(`${q} -> none`)
  }
  await mongoose.disconnect()
}
main().catch((e)=>{console.error(e);process.exit(1)})
