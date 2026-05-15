/**
 * Seeds Tuscany's actual fee schedule into Settings.customFees.
 *
 * Every fee — including system-managed ones (Late, NSF, Auction) — is a row
 * in `customFees`. The `code` field tags system entries so the cron / lien-
 * escalation logic can find them by intent. Admin can rename, delete, or add
 * fees freely from /admin/settings/fees.
 *
 * Idempotent — merges by id (preserves admin-added rows, upserts ours).
 *
 * Run with: npm run seed:fees
 */
import mongoose from 'mongoose'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

const TUSCANY_FEES = [
  // System fees (have `code`)
  { id: 'fee_late',    code: 'late',    name: 'Past Due Fee',       amount: 2000, description: 'Applied after 5 days past due',                       active: true },
  { id: 'fee_nsf',     code: 'nsf',     name: 'Returned check fee', amount: 1500, description: 'Non-sufficient funds or returned check',              active: true },
  { id: 'fee_auction', code: 'auction', name: 'Auction Fee',        amount: 5000, description: 'Fee for auction day related expenses',                active: true },
  // Tuscany custom fees
  { id: 'fee_cut_lock',          name: 'Cut Lock',           amount: 2000, description: 'Materials and Labor to cut off lock',                    active: true },
  { id: 'fee_certified_letter',  name: 'Certified Letter',   amount: 2500, description: 'Notice of foreclosure of lien certified letter',         active: true },
  { id: 'fee_advertisement',     name: 'Advertisement Fee',  amount: 2500, description: 'Ad placed in local paper about auction/sale',            active: true },
]

async function run() {
  console.log('Connecting to MongoDB…')
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!
  const settings = db.collection('settings')

  const existing = await settings.findOne({})
  if (!existing) {
    console.error('No Settings document found. Run `npm run seed:settings` first.')
    await mongoose.disconnect()
    process.exit(1)
  }

  // Merge by id — preserve admin-added rows, upsert ours.
  const current = (existing.customFees ?? []) as Array<{ id: string }>
  const map = new Map(current.map((f) => [f.id, f]))
  for (const f of TUSCANY_FEES) map.set(f.id, f)
  const merged = Array.from(map.values())

  // Also keep the deprecated top-level amount fields in sync so any legacy
  // cron/lien code still reading them gets the right values.
  const lateAmount = TUSCANY_FEES.find((f) => f.id === 'fee_late')!.amount
  const nsfAmount = TUSCANY_FEES.find((f) => f.id === 'fee_nsf')!.amount
  const auctionAmount = TUSCANY_FEES.find((f) => f.id === 'fee_auction')!.amount

  await settings.updateOne(
    { _id: existing._id },
    {
      $set: {
        customFees: merged,
        lateFeeAmount: lateAmount,
        nsfFeeAmount: nsfAmount,
        auctionFeeAmount: auctionAmount,
        updatedAt: new Date(),
      },
    }
  )

  console.log(`\nApplied ${TUSCANY_FEES.length} fees (3 system + 3 custom):\n`)
  for (const f of TUSCANY_FEES) {
    const tag = f.code ? ` [system:${f.code}]` : ''
    console.log(`  ${f.name.padEnd(28)} $${(f.amount / 100).toFixed(2).padStart(7)}${tag}`)
  }
  console.log(`\nTotal customFees in DB: ${merged.length}`)

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
