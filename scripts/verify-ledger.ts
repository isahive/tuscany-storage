/**
 * One-off: for each fed customer, simulate GET /api/tenants/[id]/balance —
 * sum balanceDelta over every Payment row — and compare with tenant.balance.
 */
import mongoose from 'mongoose'
import { balanceDelta } from '../lib/paymentBalance'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const EMAILS = [
  'marlowapril09@hmail.com',
  'adlawson312@gmail.com',
  'ben@poeppelmanmaterials.com',
  'bobbyneland1966@gmail.com',
]

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  for (const email of EMAILS) {
    const t = await db.collection('tenants').findOne({ email })
    if (!t) { console.log(`${email}: NOT FOUND`); continue }
    const rows = await db.collection('payments').find({ tenantId: t._id }).sort({ createdAt: 1, _id: 1 }).toArray()
    const recompute = rows.reduce(
      (s, r) => s + balanceDelta({ direction: (r.direction ?? 'charge') as 'charge' | 'payment', status: r.status, amount: r.amount }),
      0,
    )
    const ok = recompute === (t.balance ?? 0)
    console.log(`${t.firstName} ${t.lastName} <${email}>: tenant.balance=${(t.balance / 100).toFixed(2)} app-recompute=${(recompute / 100).toFixed(2)} ${ok ? '✔' : '✘ DRIFT'}`)
  }
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
