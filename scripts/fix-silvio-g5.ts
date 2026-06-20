/**
 * One-off: the dev/test account Silvio Lorenzana (info2@hivemediastop.com) was
 * swept up by the May bad-import and given a spurious G5 lease with a $1,840
 * phantom balance, lockout and a scheduled auction — none backed by storEDGE.
 *
 * Fix: end the G5 lease, take G5 OUT of the rentable pool (status='maintenance',
 * which the app renders as "unavailable" per lib/unitStatus.ts), unlink the
 * tenant, wipe the 14 bogus payment rows, and reset the tenant to a clean
 * $0 / active / no-lockout / no-auction state.
 *
 * Usage: npx tsx --env-file=.env.local scripts/fix-silvio-g5.ts [--apply]
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }
const APPLY = process.argv.includes('--apply')
const EMAIL = 'info2@hivemediastop.com'
const UNIT = 'G5'

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const now = new Date()

  const tenant = await db.collection('tenants').findOne({ email: EMAIL })
  const unit = await db.collection('units').findOne({ unitNumber: UNIT })
  if (!tenant || !unit) { console.error('tenant or unit not found'); process.exit(1) }

  const leases = await db.collection('leases').find({ tenantId: tenant._id, unitId: unit._id }).toArray()
  const payCount = await db.collection('payments').countDocuments({ tenantId: tenant._id })

  console.log(`Tenant : ${tenant.firstName} ${tenant.lastName} <${EMAIL}> bal=${tenant.balance} status=${tenant.status}`)
  console.log(`Unit   : ${UNIT} status=${unit.status} currentTenantId=${unit.currentTenantId ?? '-'}`)
  console.log(`Leases : ${leases.map((l) => `${l._id}[${l.status}]`).join(', ') || 'none'}`)
  console.log(`Payments to delete: ${payCount}`)
  console.log(`Plan: end lease(s) → unit G5 = 'maintenance' (displays "unavailable") + unlink → wipe payments → tenant $0/active/clear lockout`)

  if (!APPLY) { console.log('\nDry run — re-run with --apply to write.'); await mongoose.disconnect(); return }

  for (const l of leases) {
    await db.collection('leases').updateOne(
      { _id: l._id },
      { $set: { status: 'ended', endDate: now, updatedAt: now }, $unset: { auctionDate: 1, auctionScheduledAt: 1 } },
    )
    console.log(`ended lease ${l._id}`)
  }

  const u = await db.collection('units').updateOne(
    { _id: unit._id },
    { $set: { status: 'maintenance', updatedAt: now }, $unset: { currentTenantId: 1, currentLeaseId: 1 } },
  )
  console.log(`unit ${UNIT} → maintenance, unlinked (modified ${u.modifiedCount})`)

  const del = await db.collection('payments').deleteMany({ tenantId: tenant._id })
  console.log(`deleted ${del.deletedCount} payment row(s)`)

  await db.collection('tenants').updateOne(
    { _id: tenant._id },
    { $set: { balance: 0, status: 'active', updatedAt: now }, $unset: { lockedOutAt: 1 } },
  )
  console.log(`tenant reset: balance=0, status=active, lockout cleared`)
  console.log('Done.')
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
