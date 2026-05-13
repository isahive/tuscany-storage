/**
 * Sync unit.status with unit.currentTenantId.
 *
 * Invariants enforced:
 *   - unit.currentTenantId set  → status MUST be 'occupied' (unless already 'reserved')
 *   - unit.currentTenantId null → status MUST be 'available' (unless 'maintenance')
 *
 * Reports every change and skips dry-run when --apply is passed.
 *
 * Run with:
 *   npm run sync:units               (dry run — prints what would change)
 *   npm run sync:units -- --apply    (actually writes to DB)
 */
import mongoose from 'mongoose'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

const APPLY = process.argv.includes('--apply')

async function run() {
  console.log(`Connecting to MongoDB…`)
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!
  const units = db.collection('units')

  const allUnits = await units.find({}).toArray()
  console.log(`Loaded ${allUnits.length} units. Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const changes: Array<{ unit: string; from: string; to: string; reason: string }> = []

  for (const u of allUnits) {
    const hasTenant = !!u.currentTenantId
    const status = u.status

    let next: string | null = null
    let reason = ''

    if (hasTenant) {
      // Has tenant → should be occupied (or stay reserved if already reserved)
      if (status !== 'occupied' && status !== 'reserved') {
        next = 'occupied'
        reason = `has currentTenantId but status was "${status}"`
      }
    } else {
      // No tenant → should be available (unless under maintenance)
      if (status !== 'available' && status !== 'maintenance') {
        next = 'available'
        reason = `no tenant but status was "${status}"`
      }
    }

    if (next) {
      changes.push({ unit: u.unitNumber, from: status, to: next, reason })
      if (APPLY) {
        await units.updateOne(
          { _id: u._id },
          { $set: { status: next, updatedAt: new Date() } }
        )
      }
    }
  }

  if (changes.length === 0) {
    console.log('All units already in sync. Nothing to do.')
  } else {
    console.log(`${changes.length} unit${changes.length === 1 ? '' : 's'} ${APPLY ? 'updated' : 'would change'}:\n`)
    for (const c of changes) {
      console.log(`  ${c.unit}: ${c.from} → ${c.to}   (${c.reason})`)
    }
    if (!APPLY) {
      console.log(`\nDry run only. Re-run with --apply to persist.`)
    }
  }

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
