/**
 * Seeds the products Tuscany actually sells. Idempotent (upsert by name).
 *
 * Run with:
 *   npm run seed:products             # upsert listed products (preserve others)
 *   npm run seed:products -- --clean  # also remove any product NOT in the list
 */
import mongoose from 'mongoose'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

const CLEAN = process.argv.includes('--clean')

// What Tuscany actually carries
const PRODUCTS = [
  {
    name: 'Disc Lock',
    price: 1500,       // $15.00
    cost: 700,
    description: 'High-security disc padlock for storage units',
    inventory: 50,
  },
]

async function run() {
  console.log('Connecting to MongoDB…')
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!
  const products = db.collection('products')

  const allowedNames = new Set(PRODUCTS.map((p) => p.name))

  let removed = 0
  if (CLEAN) {
    const stale = await products.find({ name: { $nin: Array.from(allowedNames) } }).toArray()
    if (stale.length > 0) {
      const result = await products.deleteMany({ name: { $nin: Array.from(allowedNames) } })
      removed = result.deletedCount ?? 0
      console.log(`Removed ${removed} product${removed === 1 ? '' : 's'} not in the seed list:`)
      stale.forEach((p) => console.log(`  - ${p.name}`))
    }
  }

  let created = 0
  let updated = 0
  for (const p of PRODUCTS) {
    const existing = await products.findOne({ name: p.name })
    if (existing) {
      await products.updateOne(
        { _id: existing._id },
        { $set: { ...p, taxRate: existing.taxRate ?? 0, active: true, updatedAt: new Date() } }
      )
      updated++
    } else {
      await products.insertOne({
        ...p,
        taxRate: 0,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      created++
    }
  }

  console.log(`\nProducts: ${created} created, ${updated} updated, ${removed} removed.`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
