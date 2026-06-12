/**
 * One-off: remove the spurious late/past-due fees the pre-fix delinquency
 * cron stamped on the tenants created/relinked on 6/11 (their leases were
 * hours old — the new-lease guard now prevents this). Restores them to
 * active and clears the auction fields the lockout left behind.
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const EMAILS = [
  'cjohnson247iw.cj@gmail.com',
  'rjweltch@gmail.com',
  'tlamcghee@gmail.com',
  'martina.hurst000@icloud.com',
  'rubyduff2018@gmail.com',
]

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const now = new Date()
  for (const email of EMAILS) {
    const t = await db.collection('tenants').findOne({ email })
    if (!t) { console.log(`skip ${email}: not found`); continue }
    const del = await db.collection('payments').deleteMany({
      tenantId: t._id,
      status: 'pending',
      $or: [
        { stripePaymentIntentId: { $regex: '^late_fee_' } },
        { stripePaymentIntentId: { $regex: '^latelienfee:' } },
      ],
    })
    // Carlos's balance absorbed the fee rows via the recompute route; the
    // others never got recomputed. Recompute-equivalent: subtract what we
    // just deleted only if it was ever added — safest is to recompute from
    // the remaining rows the same way /api/tenants/[id]/balance does.
    const rows = await db.collection('payments').find({ tenantId: t._id }).toArray()
    const recompute = rows.reduce((s, r) => {
      const dir = r.direction ?? 'charge'
      if (dir === 'charge') return s + r.amount
      if (r.status === 'failed' || r.status === 'refunded') return s
      return s - r.amount
    }, 0)
    await db.collection('tenants').updateOne(
      { _id: t._id },
      { $set: { balance: recompute, status: 'active', updatedAt: now }, $unset: { lockedOutAt: 1 } },
    )
    await db.collection('leases').updateMany(
      { tenantId: t._id, status: 'active' },
      { $set: { updatedAt: now }, $unset: { auctionDate: 1, auctionScheduledAt: 1 } },
    )
    console.log(`${email}: removed ${del.deletedCount} spurious fee rows, balance=${(recompute / 100).toFixed(2)}, status=active, auction cleared`)
  }
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
