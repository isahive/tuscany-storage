import mongoose from 'mongoose'
const URI = process.env.MONGODB_URI!
async function main() {
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  const email = 'karaandbryce7709@gmail.com'
  const t = await db.collection('tenants').findOne({ email: new RegExp(`^${email}$`,'i') })
  if (!t) { console.log('NOT FOUND'); await mongoose.disconnect(); return }
  console.log(`${t.firstName} ${t.lastName} | ${t.email}`)
  console.log(`  status=${t.status} | archived=${t.archived} | onWaitingList=${t.onWaitingList} | balance=${t.balance} | phone=${t.phone||'-'}`)
  const leases = await db.collection('leases').find({ tenantId: t._id }).toArray()
  for (const l of leases) { const u = await db.collection('units').findOne({_id:l.unitId}); console.log(`  lease ${u?.unitNumber}[${l.status}]`) }
  const pays = await db.collection('payments').countDocuments({ tenantId: t._id })
  console.log(`  payRows=${pays}`)
  const wl = await db.collection('waitinglists').find({ email: new RegExp(`^${email}$`,'i') }).toArray()
  console.log(`  waitlist entries=${wl.length}`)
  await mongoose.disconnect()
}
main().catch((e)=>{console.error(e);process.exit(1)})
