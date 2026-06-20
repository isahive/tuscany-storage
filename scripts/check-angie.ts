import mongoose from 'mongoose'
const URI = process.env.MONGODB_URI!
async function main() {
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  const t = await db.collection('tenants').findOne({ email: /bacase404/i })
  console.log('TENANT:', t ? `${t.firstName} ${t.lastName} | ${t.email} | onWaitingList=${t.onWaitingList} | notes=${JSON.stringify(t.notes)} | status=${t.status}` : 'not found')
  const wl = await db.collection('waitinglists').find({ email: /bacase404/i }).toArray()
  console.log(`WAITINGLIST entries (${wl.length}):`)
  for (const w of wl) console.log(`  ${w.name} | ${w.email} | size=${w.preferredSize} | type=${w.preferredType} | status=${w.status} | notes=${JSON.stringify(w.notes)}`)
  const totalWl = await db.collection('waitinglists').countDocuments({})
  console.log(`Total waitinglist docs: ${totalWl}`)
  await mongoose.disconnect()
}
main().catch((e)=>{console.error(e);process.exit(1)})
