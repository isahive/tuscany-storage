import mongoose from 'mongoose'
import crypto from 'crypto'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

async function main() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!
  console.log('Connected.')

  // Find john@example.com
  const tenant = await db.collection('tenants').findOne({ email: 'john@example.com' })
  if (!tenant) {
    console.error('Tenant john@example.com not found')
    process.exit(1)
  }
  console.log(`Found tenant: ${tenant.firstName} ${tenant.lastName} (${tenant._id})`)

  // Find active lease
  const lease = await db.collection('leases').findOne({
    tenantId: tenant._id,
    status: { $in: ['active', 'pending_moveout'] },
  })
  if (!lease) {
    console.error('No active lease found for this tenant')
    process.exit(1)
  }
  console.log(`Found lease: ${lease._id}, monthlyRate: $${(lease.monthlyRate / 100).toFixed(2)}, unit: ${lease.unitId}`)

  // April 2026 period
  const periodStart = new Date('2026-04-01T00:00:00.000Z')
  const periodEnd   = new Date('2026-04-30T23:59:59.000Z')

  const payment = {
    tenantId: tenant._id,
    leaseId:  lease._id,
    unitId:   lease.unitId,
    stripePaymentIntentId: `pi_mock_pending_${crypto.randomBytes(8).toString('hex')}`,
    amount:   lease.monthlyRate,
    currency: 'usd',
    type:     'rent',
    status:   'pending',
    periodStart,
    periodEnd,
    attemptCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const result = await db.collection('payments').insertOne(payment)
  console.log(`✓ Injected pending payment: ${result.insertedId}  $${(payment.amount / 100).toFixed(2)} for April 2026`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
