/**
 * Quick sanity check: list collections + doc counts on whatever MONGODB_URI
 * is currently set. Used before/after the local→Atlas migration.
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const cols = await db.listCollections().toArray()
  console.log(`Connected to: ${URI!.replace(/\/\/[^@]+@/, '//***@')}`)
  console.log(`Collections: ${cols.length}\n`)
  const sorted = cols.map((c) => c.name).sort()
  for (const name of sorted) {
    const n = await db.collection(name).countDocuments({})
    console.log(`  ${name.padEnd(35)} ${n.toLocaleString()} docs`)
  }
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
