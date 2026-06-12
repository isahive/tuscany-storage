/**
 * One-off: stagger April's same-day imported rows by a minute each so the
 * portal's newest-first billing history shows the payment on top, matching
 * the storEDGE display order.
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const IDS = ['storable_134207293', 'storable_134207294', 'storable_134207295', 'storable_96184197']

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  for (let i = 0; i < IDS.length; i++) {
    const d = new Date(Date.UTC(2026, 5, 5, 12, i, 0))
    await db.collection('payments').updateOne(
      { stripePaymentIntentId: IDS[i] },
      { $set: { createdAt: d, updatedAt: d, lastAttemptAt: d } },
    )
  }
  const rows = await db.collection('payments').find({ stripePaymentIntentId: { $in: IDS } }).sort({ createdAt: -1 }).toArray()
  rows.forEach((p) => console.log(p.createdAt.toISOString(), p.direction, p.type, p.amount, 'after=' + p.balanceAfter))
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
