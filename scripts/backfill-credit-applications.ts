/**
 * One-shot reconciliation for credit rows created before the FIFO
 * application fix landed. Pre-fix the credit endpoint only decremented
 * tenant.balance — it never marked pending charge rows as 'succeeded' nor
 * set appliedToItemIds on the credit. Result: line items kept showing as
 * outstanding on the Make Payment screen even though the running balance
 * was already $0 (or negative).
 *
 * This script walks every tenant, finds credit rows missing
 * appliedToItemIds, and FIFO-applies them against still-pending charge
 * rows using the same logic the fixed endpoint now uses for new credits.
 *
 * Safe to re-run: rows with appliedToItemIds already set are skipped.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-credit-applications.ts
 *   npx tsx --env-file=.env.local scripts/backfill-credit-applications.ts --dry-run
 */
import { connectDB } from '../lib/db'
import Payment from '../models/Payment'
import { Types } from 'mongoose'

const PENDING_ITEM_TYPES = ['rent', 'late_fee', 'deposit', 'prorated', 'other']

interface OrphanCredit {
  _id: Types.ObjectId
  tenantId: Types.ObjectId
  amount: number
  createdAt: Date
}

interface PendingItem {
  _id: Types.ObjectId
  amount: number
  taxRate?: number
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  await connectDB()

  const orphans = await Payment.find({
    type: 'credit',
    status: 'succeeded',
    direction: 'payment',
    $or: [
      { appliedToItemIds: { $exists: false } },
      { appliedToItemIds: { $size: 0 } },
    ],
  })
    .sort({ createdAt: 1, _id: 1 })
    .select('_id tenantId amount createdAt')
    .lean<OrphanCredit[]>()

  console.log(`Found ${orphans.length} orphan credit row(s)${dryRun ? ' (dry-run)' : ''}`)

  let totalItemsSettled = 0
  let creditsUpdated = 0

  for (const credit of orphans) {
    // Re-fetch pending items per credit so back-to-back credits on the same
    // tenant don't double-apply against the same items (an earlier credit
    // settles them; the next sees fewer pending).
    const pending = await Payment.find({
      tenantId: credit.tenantId,
      status: 'pending',
      type: { $in: PENDING_ITEM_TYPES },
      // Only consider items that existed BEFORE this credit was issued —
      // otherwise an old credit would gobble up new invoices the admin
      // expected to be owed.
      createdAt: { $lte: credit.createdAt },
    })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id amount taxRate')
      .lean<PendingItem[]>()

    const settled: Types.ObjectId[] = []
    let remaining = credit.amount
    for (const item of pending) {
      const itemTotal = item.amount + Math.round(item.amount * ((item.taxRate ?? 0) / 100))
      if (remaining < itemTotal) break
      remaining -= itemTotal
      settled.push(item._id)
    }

    if (settled.length === 0) {
      console.log(
        `  credit ${credit._id} (tenant ${credit.tenantId}, $${(credit.amount / 100).toFixed(2)}): no items to settle, skipping`,
      )
      continue
    }

    console.log(
      `  credit ${credit._id} (tenant ${credit.tenantId}, $${(credit.amount / 100).toFixed(2)}): settling ${settled.length} item(s), residual $${(remaining / 100).toFixed(2)}`,
    )

    if (!dryRun) {
      await Payment.updateMany(
        { _id: { $in: settled }, tenantId: credit.tenantId, status: 'pending' },
        { $set: { status: 'succeeded', lastAttemptAt: new Date() } },
      )
      await Payment.updateOne(
        { _id: credit._id },
        { $set: { appliedToItemIds: settled } },
      )
    }

    totalItemsSettled += settled.length
    creditsUpdated += 1
  }

  console.log(
    `\nDone. Credits updated: ${creditsUpdated}. Items settled: ${totalItemsSettled}.${dryRun ? ' (dry-run — no writes)' : ''}`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
