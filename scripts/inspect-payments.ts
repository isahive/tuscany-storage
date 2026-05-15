import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

async function main() {
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  const payments = db.collection('payments')

  const total = await payments.countDocuments({})
  console.log(`Total payment rows: ${total}\n`)

  const byDirection = await payments
    .aggregate([{ $group: { _id: '$direction', n: { $sum: 1 } } }])
    .sort({ _id: 1 })
    .toArray()
  console.log('Distribution by direction:')
  for (const r of byDirection) console.log(`  ${String(r._id ?? '<missing>').padEnd(12)} ${r.n}`)

  console.log('\nDistribution by importSource:')
  const byImport = await payments
    .aggregate([{ $group: { _id: '$importSource', n: { $sum: 1 } } }])
    .sort({ _id: 1 })
    .toArray()
  for (const r of byImport) console.log(`  ${String(r._id ?? '<none>').padEnd(40)} ${r.n}`)

  console.log('\nDistribution by (type, direction):')
  const byTypeDir = await payments
    .aggregate([{ $group: { _id: { type: '$type', direction: '$direction' }, n: { $sum: 1 } } }])
    .sort({ '_id.type': 1, '_id.direction': 1 })
    .toArray()
  for (const r of byTypeDir) {
    console.log(`  type=${String(r._id.type).padEnd(10)} direction=${String(r._id.direction ?? '<missing>').padEnd(10)} ${r.n}`)
  }

  console.log('\n--- 5 sample rent-charge-backfill rows ---')
  const samples = await payments.find({ importSource: 'rent-charge-backfill' }).limit(5).toArray()
  for (const s of samples) {
    console.log({
      _id: s._id,
      type: s.type,
      status: s.status,
      direction: s.direction,
      amount: s.amount,
      importSource: s.importSource,
      description: (s.description ?? '').slice(0, 50),
    })
  }

  console.log('\n--- 5 sample type=rent direction=payment rows (should NOT include rent-charge-backfill) ---')
  const rentPayments = await payments.find({ type: 'rent', direction: 'payment' }).limit(5).toArray()
  for (const s of rentPayments) {
    console.log({
      _id: s._id,
      type: s.type,
      status: s.status,
      direction: s.direction,
      amount: s.amount,
      importSource: s.importSource,
      description: (s.description ?? '').slice(0, 50),
    })
  }

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
