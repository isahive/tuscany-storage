/**
 * Backfill Payment.balanceAfter for every existing row.
 *
 * For each tenant: walks their Payment rows oldest→newest, applies the same
 * balance-delta rule the UI uses, persists balanceAfter on every row, and
 * finally syncs tenant.balance to the last running value.
 *
 * Idempotent — re-running just overwrites with fresh values.
 */
import mongoose from 'mongoose'
import { balanceDelta } from '../lib/paymentBalance'

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

async function main() {
  console.log('Connecting to MongoDB…')
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  console.log('Connected.')

  const payments = db.collection('payments')
  const tenants = db.collection('tenants')

  const tenantIds = await payments.distinct('tenantId')
  console.log(`Tenants with payments: ${tenantIds.length}\n`)

  let totalRowsUpdated = 0

  for (const tenantId of tenantIds) {
    const rows = await payments
      .find({ tenantId })
      .sort({ createdAt: 1, _id: 1 })
      .toArray()

    let running = 0
    const bulkOps = rows.map((r) => {
      running += balanceDelta({
        direction: r.direction ?? 'charge',
        status: r.status ?? 'pending',
        amount: r.amount,
      })
      return {
        updateOne: {
          filter: { _id: r._id },
          update: { $set: { balanceAfter: running } },
        },
      }
    })

    if (bulkOps.length > 0) {
      const res = await payments.bulkWrite(bulkOps, { ordered: false })
      totalRowsUpdated += res.modifiedCount ?? 0
    }

    await tenants.updateOne({ _id: tenantId }, { $set: { balance: running } })
  }

  console.log(`\nDone. Updated ${totalRowsUpdated} Payment rows across ${tenantIds.length} tenants.`)
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
