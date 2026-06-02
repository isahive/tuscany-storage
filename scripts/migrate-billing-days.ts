/**
 * Realign every active lease's `billingDay` with the current
 * `billingCycleAnchor` setting. Used to migrate leases imported from
 * Storable (where each tenant kept their original signup day) onto the
 * facility-wide billing cadence the admin has chosen.
 *
 * Behavior per anchor:
 *   - `first_of_month` → all leases → 1
 *   - `custom_day`     → all leases → settings.billingCycleCustomDay
 *   - `signup_day`     → script is a no-op (each lease already matches its
 *                         own start date; rewriting would not change
 *                         anything but we still report so admins know)
 *
 * Always defaults to DRY RUN — pass `--apply` to actually write.
 *
 * Caveats:
 *   - Changes the next invoice date for every active tenant. If
 *     `generateInvoices` has already fired for the current cycle, no new
 *     invoice will be created until the new billing day comes around.
 *   - Tenants on autopay may see a cobro shift by a few days.
 *   - Run in a low-traffic window (e.g. just after recurring-billing for the
 *     month finishes) so no payments are mid-flight.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/migrate-billing-days.ts            # dry run
 *   npx tsx --env-file=.env.local scripts/migrate-billing-days.ts --apply    # write
 */
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Settings from '@/models/Settings'
import { computeBillingDay } from '@/lib/billing/billingDay'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(`[migrate-billing-days] ${APPLY ? 'APPLYING' : 'DRY RUN'}`)
  await connectDB()

  const settings = (await Settings.findOne({}).lean()) as any | null
  const anchor = settings?.billingCycleAnchor ?? DEFAULT_SETTINGS.billingCycleAnchor
  const customDay = settings?.billingCycleCustomDay ?? DEFAULT_SETTINGS.billingCycleCustomDay
  console.log(`Settings: billingCycleAnchor=${anchor}, billingCycleCustomDay=${customDay}`)

  const leases = await Lease.find({ status: 'active' }).select('_id billingDay startDate')
  console.log(`Active leases scanned: ${leases.length}\n`)

  const histogramBefore = new Map<number, number>()
  const histogramAfter = new Map<number, number>()
  const changes: Array<{ id: string; from: number; to: number }> = []

  for (const lease of leases) {
    const before = (lease as any).billingDay as number
    const after = computeBillingDay(
      { billingCycleAnchor: anchor, billingCycleCustomDay: customDay },
      (lease as any).startDate ?? new Date(),
    )

    histogramBefore.set(before, (histogramBefore.get(before) ?? 0) + 1)
    histogramAfter.set(after, (histogramAfter.get(after) ?? 0) + 1)

    if (before !== after) {
      changes.push({ id: String(lease._id), from: before, to: after })
    }
  }

  console.log('Before (top 10 buckets):')
  for (const [day, n] of [...histogramBefore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  day ${String(day).padStart(2, ' ')} → ${n} leases`)
  }
  console.log('\nAfter (top 10 buckets):')
  for (const [day, n] of [...histogramAfter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  day ${String(day).padStart(2, ' ')} → ${n} leases`)
  }
  console.log(`\nLeases that would change: ${changes.length} / ${leases.length}`)

  if (!APPLY) {
    console.log('\n(dry run — pass --apply to write)')
    return
  }

  if (changes.length === 0) {
    console.log('\nNo changes to apply.')
    return
  }

  let updated = 0
  for (const c of changes) {
    await Lease.updateOne({ _id: c.id }, { $set: { billingDay: c.to } })
    updated++
    if (updated % 25 === 0) process.stdout.write(`  ${updated}\r`)
  }
  console.log(`\nDone — updated ${updated} leases.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
