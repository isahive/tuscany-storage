/**
 * One-off: find April Marlow across collections to debug why her
 * account shows no data.
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const APRIL_EMAIL_TENANT = '6a0406024c2b36dc45f09e6b' // marlowapril09@gmail.com, named "Michael j higginbotham"

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const id = new mongoose.Types.ObjectId(APRIL_EMAIL_TENANT)

  for (const col of ['units', 'leases']) {
    const docs = await db
      .collection(col)
      .find({ $or: [{ tenantId: id }, { tenantId: APRIL_EMAIL_TENANT }, { tenant: id }] })
      .limit(20)
      .toArray()
    console.log(`\n=== ${col} for tenant ${APRIL_EMAIL_TENANT}: ${docs.length} ===`)
    for (const d of docs) console.log(JSON.stringify(d, null, 2))
  }

  // Any tenant named Higginbotham with a different email? (possible swap)
  const higg = await db
    .collection('tenants')
    .find({ $or: [{ lastName: /higginbotham/i }, { firstName: /michael/i, lastName: /higg/i }] })
    .project({ firstName: 1, lastName: 1, email: 1, phone: 1, status: 1, balance: 1 })
    .limit(10)
    .toArray()
  console.log(`\n=== tenants matching higginbotham: ${higg.length} ===`)
  for (const d of higg) console.log(JSON.stringify(d))

  // Units whose tenantName-ish fields mention marlow or higginbotham
  const unitHits = await db
    .collection('units')
    .find({ $or: [{ tenantName: /marlow|higginbotham/i }, { notes: /marlow/i }] })
    .limit(10)
    .toArray()
  console.log(`\n=== units mentioning marlow/higginbotham: ${unitHits.length} ===`)
  for (const d of unitHits) console.log(JSON.stringify(d, null, 2))

  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
