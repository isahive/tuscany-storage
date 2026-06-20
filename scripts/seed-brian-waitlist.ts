/** One-off: seed Brian Case's waiting-list signup + memo from Storable. */
import mongoose from 'mongoose'
const URI = process.env.MONGODB_URI!
const APPLY = process.argv.includes('--apply')
async function main() {
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  const now = new Date()
  const email = 'bacase404@gmail.com'
  const t = await db.collection('tenants').findOne({ email })
  if (!t) { console.error('Brian Case not found'); process.exit(1) }
  const existing = await db.collection('waitinglists').findOne({ email })
  console.log(`Tenant: ${t.firstName} ${t.lastName} | notes=${JSON.stringify(t.notes)} | onWaitingList=${t.onWaitingList}`)
  console.log(`Existing waitinglist entry: ${existing ? existing._id : 'none'}`)
  if (!APPLY) { console.log('\nDry run — re-run with --apply.'); await mongoose.disconnect(); return }

  if (!existing) {
    await db.collection('waitinglists').insertOne({
      name: `${t.firstName} ${t.lastName}`.trim(),
      email,
      phone: '(865) 206-1402',
      preferredSize: '10 x 30',
      preferredType: 'Boat, RV, Camper & Trailer - Open Air',
      notes: "24' break-neck, single axle trailer needing storage.",
      smsOptIn: false,
      status: 'waiting',
      createdAt: now,
      updatedAt: now,
    })
    console.log('Inserted waitinglist entry.')
  }
  await db.collection('tenants').updateOne(
    { _id: t._id },
    { $set: { notes: "24' break-neck, single axle trailer needing storage.", onWaitingList: true, updatedAt: now } },
  )
  console.log('Tenant memo + onWaitingList set.')
  await mongoose.disconnect()
  console.log('Done.')
}
main().catch((e) => { console.error(e); process.exit(1) })
