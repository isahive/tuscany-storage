/**
 * Generates the historical rent charges (Payment docs with status='pending')
 * that should have existed on each active lease, then marks them 'succeeded'
 * if the tenant's imported payment history covers them.
 *
 * Why: the live CSV only carries payments — not invoices. Without explicit
 * monthly charges with dueDate, computeDisplayStatus has nothing to compare
 * "today" against, so Late/Pre-Lien/Lien never fire on the units grid.
 *
 * Strategy:
 *   1. For each active or pending_moveout Lease:
 *       a. Walk months from lease.startDate to today.
 *       b. For each month, ensure a Payment exists with type='rent' for that
 *          period. dueDate = billing-day anchor of that month.
 *       c. Status starts 'pending'; if cumulative payments (sum of succeeded
 *          rent Payments for that lease) cover the cumulative invoice total,
 *          we flip the oldest pending invoices to 'succeeded' in order.
 *   2. Print per-tenant summary so we can spot weird ones.
 *
 * Idempotent: invoices are tagged with stripePaymentIntentId='rent_<leaseId>_<YYYY-MM>'
 * so re-running merges instead of duplicating.
 *
 * Run with:
 *   npm run import:rent-charges
 */
import mongoose from 'mongoose'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'

function clampBillingDay(year: number, monthIdx: number, day: number): Date {
  // monthIdx is 0-based. Use last day of month if billing day overflows (Feb 30 etc).
  const lastDay = new Date(year, monthIdx + 1, 0).getDate()
  const safe = Math.min(day, lastDay)
  return new Date(year, monthIdx, safe)
}

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function run() {
  console.log(`Connecting to MongoDB…`)
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db!
  const leases = db.collection('leases')
  const payments = db.collection('payments')
  const tenants = db.collection('tenants')

  const now = new Date()
  const activeLeases = await leases.find({ status: { $in: ['active', 'pending_moveout'] } }).toArray()
  console.log(`Found ${activeLeases.length} active/pending-moveout leases.`)

  let invoicesCreated = 0
  let invoicesMarkedSucceeded = 0
  let invoicesLeftPending = 0
  let leasesRebased = 0

  // Wipe stale backfill invoices on every run — we regenerate them from the
  // possibly-updated lease.startDate so the math doesn't compound across runs.
  const wipe = await payments.deleteMany({ importSource: 'rent-charge-backfill' })
  console.log(`Cleared ${wipe.deletedCount} prior backfill invoices.\n`)

  for (const lease of activeLeases) {
    // Re-anchor lease.startDate to the tenant's earliest imported Sale if it's
    // earlier than the current startDate. Otherwise we generate too few invoices
    // and the tenant accumulates a phantom credit (Alan Wolfe case).
    const earliestImport = await payments.findOne(
      {
        tenantId: lease.tenantId,
        type: 'rent',
        status: 'succeeded',
        importSource: { $regex: '^storable-csv-' },
      },
      { sort: { createdAt: 1 } },
    )
    if (earliestImport && new Date(earliestImport.createdAt) < new Date(lease.startDate)) {
      const newStart = new Date(earliestImport.createdAt)
      const newBillingDay = Math.max(1, Math.min(28, newStart.getDate()))
      await leases.updateOne(
        { _id: lease._id },
        { $set: { startDate: newStart, billingDay: newBillingDay, updatedAt: now } },
      )
      lease.startDate = newStart
      lease.billingDay = newBillingDay
      leasesRebased++
    }

    // Re-derive monthlyRate from the actual payment history. unit.price is the
    // current sticker rate, but grandfathered tenants pay the old rate (Alan
    // Wolfe was on $85 while the unit lists $120). Use the mode of recent Sale
    // amounts to get the real recurring rent.
    const recentSales = await payments
      .find({
        tenantId: lease.tenantId,
        type: 'rent',
        status: 'succeeded',
        importSource: { $regex: '^storable-csv-' },
        // Ignore obvious lump-sums (>1.8× sticker) — multi-month catch-up payments
        // skew the mode otherwise.
        amount: { $gt: 0, $lt: Math.max(lease.monthlyRate, 50000) * 1.8 },
      })
      .sort({ createdAt: -1 })
      .limit(12)
      .toArray()
    if (recentSales.length >= 3) {
      const counts = new Map<number, number>()
      for (const p of recentSales) counts.set(p.amount, (counts.get(p.amount) ?? 0) + 1)
      const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
      if (mode && mode[0] !== lease.monthlyRate) {
        await leases.updateOne(
          { _id: lease._id },
          { $set: { monthlyRate: mode[0], updatedAt: now } },
        )
        lease.monthlyRate = mode[0]
      }
    }

    const start = new Date(lease.startDate)
    const billingDay = lease.billingDay ?? 1
    const rate = lease.monthlyRate ?? 0
    if (rate <= 0) continue

    // Enumerate every month-anchor from start up to "now".
    const anchors: Date[] = []
    let cursor = clampBillingDay(start.getFullYear(), start.getMonth(), billingDay)
    if (cursor < start) {
      cursor = clampBillingDay(start.getFullYear(), start.getMonth() + 1, billingDay)
    }
    while (cursor <= now) {
      anchors.push(new Date(cursor))
      cursor = clampBillingDay(cursor.getFullYear(), cursor.getMonth() + 1, billingDay)
    }

    // Insert any missing invoices for this lease.
    for (const dueDate of anchors) {
      const invoiceId = `rent_${lease._id.toString()}_${ymKey(dueDate)}`
      const existing = await payments.findOne({ stripePaymentIntentId: invoiceId })
      if (existing) continue
      await payments.insertOne({
        tenantId: lease.tenantId,
        leaseId: lease._id,
        unitId: lease.unitId,
        stripePaymentIntentId: invoiceId,
        amount: rate,
        currency: 'usd',
        type: 'rent',
        status: 'pending',
        periodStart: dueDate,
        periodEnd: clampBillingDay(dueDate.getFullYear(), dueDate.getMonth() + 1, billingDay - 1),
        dueDate,
        attemptCount: 0,
        description: 'Monthly rent',
        importSource: 'rent-charge-backfill',
        createdAt: dueDate,
        updatedAt: dueDate,
      })
      invoicesCreated++
    }

    // Apply imported payments oldest→newest against pending invoices.
    const succeededTotal = await payments.aggregate([
      {
        $match: {
          tenantId: lease.tenantId,
          // Treat any non-rent successful inflow as money against the balance.
          $or: [
            { leaseId: lease._id, type: { $ne: 'rent' }, status: 'succeeded' },
            { leaseId: lease._id, type: 'rent', importSource: { $ne: 'rent-charge-backfill' }, status: 'succeeded' },
            // Imported CSV Sale payments that didn't have a lease attached.
            { tenantId: lease.tenantId, status: 'succeeded', importSource: { $regex: '^storable-csv-' } },
          ],
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray()
    let credit = succeededTotal[0]?.total ?? 0

    const pendingInvoices = await payments
      .find({ leaseId: lease._id, type: 'rent', status: 'pending', importSource: 'rent-charge-backfill' })
      .sort({ dueDate: 1 })
      .toArray()

    for (const inv of pendingInvoices) {
      if (credit >= inv.amount) {
        await payments.updateOne(
          { _id: inv._id },
          {
            $set: {
              status: 'succeeded',
              attemptCount: 1,
              lastAttemptAt: inv.dueDate,
              updatedAt: new Date(),
            },
          },
        )
        credit -= inv.amount
        invoicesMarkedSucceeded++
      } else {
        invoicesLeftPending++
      }
    }
  }

  // Push outstanding balance back onto each tenant.
  // Note: we count *only* pending invoices, not failed CSV payments — those
  // are auth attempts in the live system that get retried, not real charges.
  // Counting them as owed inflates balances (Alan Wolfe had a $85 phantom).
  console.log('\nRecalculating tenant balances and delinquency flags…')
  const balances = await payments.aggregate([
    {
      $group: {
        _id: '$tenantId',
        charges: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] },
        },
      },
    },
  ]).toArray()

  let delinquentCount = 0
  for (const b of balances) {
    const owes = b.charges > 0
    await tenants.updateOne(
      { _id: b._id },
      {
        $set: {
          balance: b.charges,
          // Only auto-flip status if tenant isn't already locked_out / moved_out.
          ...(owes
            ? {}
            : { /* let admin keep manual status */ }),
        },
      },
    )
    if (owes) {
      await tenants.updateOne(
        { _id: b._id, status: { $nin: ['locked_out', 'moved_out'] } },
        { $set: { status: 'delinquent' } },
      )
      delinquentCount++
    } else {
      await tenants.updateOne(
        { _id: b._id, status: 'delinquent' },
        { $set: { status: 'active' } },
      )
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Leases re-anchored to CSV:    ${leasesRebased}`)
  console.log(`Rent invoices created:        ${invoicesCreated}`)
  console.log(`Marked succeeded (paid):      ${invoicesMarkedSucceeded}`)
  console.log(`Left pending (unpaid):        ${invoicesLeftPending}`)
  console.log(`Tenants flipped to delinquent: ${delinquentCount}`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
