/**
 * Standalone script — adds the "Move-in Special" promotion to the DB without
 * touching units, tenants, leases, or anything else. Safe to run on a live DB.
 *
 * Run with: npm run seed:promo
 */
import mongoose from 'mongoose'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

async function run() {
  console.log('Connecting to MongoDB…')
  await mongoose.connect(MONGODB_URI)
  console.log('Connected.')

  const db = mongoose.connection.db!
  const promos = db.collection('promotions')

  const existing = await promos.findOne({ name: 'Move-in Special' })
  if (existing) {
    console.log(`Promotion "Move-in Special" already exists (id=${existing._id}). Nothing to do.`)
    await mongoose.disconnect()
    return
  }

  await promos.insertOne({
    name: 'Move-in Special',
    description: '1/2 off FIRST month. Prorated second month. After full deposit.',
    method: 'automatic',
    promoCode: '',
    discountType: 'percentage',
    discountValue: 50,
    unitTypes: [],
    allUnitTypes: true,
    startDate: new Date(),
    endDate: null,
    beginsImmediately: true,
    beginsAfterCycles: 0,
    noExpiration: true,
    durationCycles: 1,
    status: 'active',
    appliedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  console.log('Promotion "Move-in Special" created.')
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
