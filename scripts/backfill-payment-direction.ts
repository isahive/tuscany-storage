import mongoose from 'mongoose'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

/**
 * Backfill / reclassify the Payment.direction field.
 *
 * Idempotent: re-running overwrites direction on every row according to current
 * rules, so it's safe to run after a botched classification.
 *
 * Inference rules (applied in order — first match wins):
 *   1. type='credit'                              → 'payment' (admin credit / refund)
 *   2. status='refunded'                          → 'payment'
 *   3. amount < 0                                 → 'payment'
 *   4. importSource='rent-charge-backfill'        → 'charge'  (generate-rent-charges invoices)
 *   5. importSource starts with 'storable-csv-'   → 'payment' (real transactions)
 *   6. importSource starts with 'pdf-credits-'    → 'payment' (credit imports)
 *   7. status='pending'                           → 'charge'  (unpaid line item)
 *   8. fallback                                   → 'charge'
 */
async function main() {
  const dryRun = process.argv.includes('--dry')
  console.log(`Connecting to MongoDB…${dryRun ? '  [DRY RUN]' : ''}`)
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!
  console.log('Connected.')

  const payments = db.collection('payments')
  const total = await payments.countDocuments({})
  console.log(`Total payment rows: ${total}\n`)

  // Apply rules in REVERSE order so earlier rules overwrite later ones.
  // (Each rule writes its direction over any prior value.)
  const ruleStack: Array<{
    label: string
    filter: Record<string, unknown>
    direction: 'charge' | 'payment'
  }> = [
    { label: 'fallback                                ', filter: {}, direction: 'charge' },
    { label: 'status=pending                          ', filter: { status: 'pending' }, direction: 'charge' },
    { label: 'importSource=pdf-credits-*              ', filter: { importSource: { $regex: '^pdf-credits-' } }, direction: 'payment' },
    { label: 'importSource=storable-csv-*             ', filter: { importSource: { $regex: '^storable-csv-' } }, direction: 'payment' },
    { label: 'importSource=rent-charge-backfill       ', filter: { importSource: 'rent-charge-backfill' }, direction: 'charge' },
    { label: 'amount<0                                ', filter: { amount: { $lt: 0 } }, direction: 'payment' },
    { label: 'status=refunded                         ', filter: { status: 'refunded' }, direction: 'payment' },
    { label: 'type=credit                             ', filter: { type: 'credit' }, direction: 'payment' },
  ]

  for (const rule of ruleStack) {
    const n = await payments.countDocuments(rule.filter)
    if (dryRun) {
      console.log(`  ${rule.label} → ${rule.direction.padEnd(7)}  (would update: ${n})`)
    } else {
      const r = await payments.updateMany(rule.filter, { $set: { direction: rule.direction } })
      console.log(`  ${rule.label} → ${rule.direction.padEnd(7)}  matched: ${n}, modified: ${r.modifiedCount}`)
    }
  }

  const summary = await payments
    .aggregate([{ $group: { _id: '$direction', n: { $sum: 1 } } }])
    .sort({ _id: 1 })
    .toArray()
  console.log('\nFinal distribution:')
  for (const s of summary) console.log(`  ${s._id ?? '<null>'}: ${s.n}`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
