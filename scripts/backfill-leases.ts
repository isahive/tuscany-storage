/**
 * Backfills active leases for units that have a currentTenantId but no
 * currentLeaseId. The original seed:customers script linked tenants to units
 * but never created the Lease docs, so rent-charge generation had nothing to
 * walk through.
 *
 * For each (unit, tenant) pair without a lease:
 *   - startDate = earliest imported Sale transaction for the tenant, else
 *     today minus 12 months as a safe default.
 *   - monthlyRate = unit.price
 *   - billingDay  = clamp(startDate.getDate(), 1, 28)
 *   - status = active
 *
 * Idempotent: if a Lease exists tied to (tenantId, unitId), reuse it.
 *
 * Run with:
 *   npm run backfill:leases
 */
import mongoose from 'mongoose'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

async function run() {
  console.log(`Connecting to MongoDB…`)
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!
  const units = db.collection('units')
  const leases = db.collection('leases')
  const payments = db.collection('payments')

  const orphanUnits = await units
    .find({ currentTenantId: { $ne: null }, currentLeaseId: { $exists: false } })
    .toArray()

  console.log(`Found ${orphanUnits.length} occupied units without a lease.`)

  const now = new Date()
  const defaultStart = new Date(now.getFullYear() - 1, now.getMonth(), 1)

  let created = 0
  let linkedExisting = 0

  for (const unit of orphanUnits) {
    const tenantId = unit.currentTenantId
    if (!tenantId) continue

    // Reuse a lease that already exists for this pair.
    let lease = await leases.findOne({
      tenantId,
      unitId: unit._id,
      status: { $in: ['active', 'pending_moveout'] },
    })

    if (lease) {
      linkedExisting++
    } else {
      // Anchor lease.startDate to the tenant's earliest imported Sale, when
      // available — gives realistic delinquency math.
      const earliest = await payments.findOne(
        {
          tenantId,
          type: 'rent',
          status: 'succeeded',
          importSource: { $regex: '^storable-csv-' },
        },
        { sort: { createdAt: 1 } },
      )
      const startDate = earliest?.createdAt ?? defaultStart
      const billingDay = Math.max(1, Math.min(28, startDate.getDate()))

      const insertRes = await leases.insertOne({
        tenantId,
        unitId: unit._id,
        startDate,
        monthlyRate: unit.price ?? 0,
        deposit: unit.defaultDeposit ?? unit.price ?? 0,
        proratedFirstMonth: 0,
        billingDay,
        status: 'active',
        createdAt: startDate,
        updatedAt: now,
      })
      lease = { _id: insertRes.insertedId } as any
      created++
    }

    await units.updateOne(
      { _id: unit._id },
      { $set: { currentLeaseId: lease!._id, updatedAt: now } },
    )
  }

  console.log('\n=== Summary ===')
  console.log(`Leases created:           ${created}`)
  console.log(`Existing leases linked:   ${linkedExisting}`)
  console.log(`Units processed:          ${orphanUnits.length}`)

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
