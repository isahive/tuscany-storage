/**
 * One-off: verify April Marlow's account is healthy after the billing-history
 * import — replicates the delinquency cron's "period covered" check and the
 * portal dashboard's lease/payment queries.
 */
import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI
if (!URI) { console.error('MONGODB_URI not set'); process.exit(1) }

async function main() {
  await mongoose.connect(URI!)
  const db = mongoose.connection.db!
  const tenant = await db.collection('tenants').findOne({ email: 'marlowapril09@hmail.com' })
  const lease = await db.collection('leases').findOne({ tenantId: tenant!._id, status: 'active' })

  // ── Delinquency cron simulation (jobs/delinquency.ts) ──
  const now = new Date()
  const lastBillingDate = new Date(now.getFullYear(), now.getMonth(), Math.min(lease!.billingDay, 28))
  const effectiveLast = lastBillingDate <= now ? lastBillingDate : new Date(now.getFullYear(), now.getMonth() - 1, lease!.billingDay)
  const lastPayment = await db.collection('payments')
    .find({ tenantId: tenant!._id, leaseId: lease!._id, type: 'rent', status: 'succeeded' })
    .sort({ periodStart: -1 }).limit(1).next()
  const periodCovered = lastPayment?.periodStart
    && lastPayment.periodStart >= new Date(effectiveLast.getFullYear(), effectiveLast.getMonth(), 1)
  console.log(`Delinquency check: lastBilling=${effectiveLast.toDateString()}, lastPayment.periodStart=${lastPayment?.periodStart?.toISOString() ?? 'NONE'} → periodCovered=${!!periodCovered} ${periodCovered ? '✔ (cron will leave her active)' : '✘ WOULD ESCALATE'}`)

  // ── Portal dashboard view ──
  console.log(`\nTenant: ${tenant!.firstName} ${tenant!.lastName} | status=${tenant!.status} | balance=${tenant!.balance}`)
  console.log(`Lease: start=${lease!.startDate.toISOString().slice(0, 10)} rate=$${(lease!.monthlyRate / 100).toFixed(2)} billingDay=${lease!.billingDay} auctionDate=${lease!.auctionDate ?? 'none'}`)
  const history = await db.collection('payments').find({ tenantId: tenant!._id }).sort({ createdAt: -1 }).toArray()
  console.log(`\nBilling history (${history.length} rows, newest first):`)
  for (const p of history) {
    console.log(`  ${p.createdAt.toISOString().slice(0, 10)}  ${p.direction.padEnd(7)} ${p.type.padEnd(8)} $${(p.amount / 100).toFixed(2).padStart(7)}  balanceAfter=$${(p.balanceAfter / 100).toFixed(2)}  ${p.description.slice(0, 60)}`)
  }
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
