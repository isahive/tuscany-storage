/**
 * Resolve the day-of-month a new lease should be billed on, honoring the
 * facility's `billingCycleAnchor` setting.
 *
 * Until this helper existed every lease-creation site (rent-unit, move-in,
 * public reserve, portal reserve) hardcoded `billingDay = signupDate.getDate()`
 * which silently overrode the admin's setting. Admins who chose
 * `first_of_month` got staggered billing anyway — the bug we just caught
 * when the cron showed all 110 tenants on different days.
 *
 * Rules:
 *   - `first_of_month` → always 1
 *   - `custom_day`     → settings.billingCycleCustomDay (clamped 1..28)
 *   - `signup_day`     → the day-of-month of the signup, capped at 28 so
 *                         leases that start on 29/30/31 don't break in months
 *                         that don't have those dates
 *
 * The 28 cap matches the existing Lease zod validator (`max(28)`).
 */
import Lease from '@/models/Lease'

export interface BillingAnchorSettings {
  billingCycleAnchor: 'first_of_month' | 'signup_day' | 'custom_day'
  billingCycleCustomDay: number
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function computeBillingDay(
  settings: BillingAnchorSettings,
  signupDate: Date,
): number {
  switch (settings.billingCycleAnchor) {
    case 'first_of_month':
      return 1
    case 'custom_day':
      return clamp(settings.billingCycleCustomDay, 1, 28)
    case 'signup_day':
    default:
      return clamp(signupDate.getUTCDate(), 1, 28)
  }
}

export interface RealignSummary {
  scanned: number
  changed: number
}

/**
 * Apply the current `billingCycleAnchor` setting to every active lease,
 * patching `billingDay` only when it differs from what the rule says.
 * Used both by the one-shot migration script (`scripts/migrate-billing-days`)
 * and by the Settings PUT route — when an admin flips the anchor in the UI,
 * the change is reflected on existing leases immediately rather than
 * silently applying only to future signups.
 *
 * Safe to re-run — it's a no-op when nothing differs.
 */
export async function realignAllLeaseBillingDays(
  settings: BillingAnchorSettings,
): Promise<RealignSummary> {
  const leases = await Lease.find({ status: 'active' }).select('_id billingDay startDate')

  const ops: Array<{ updateOne: { filter: { _id: unknown }; update: { $set: { billingDay: number } } } }> = []
  for (const lease of leases) {
    const current = (lease as any).billingDay as number
    const target = computeBillingDay(settings, (lease as any).startDate ?? new Date())
    if (current !== target) {
      ops.push({ updateOne: { filter: { _id: lease._id }, update: { $set: { billingDay: target } } } })
    }
  }
  if (ops.length > 0) {
    await Lease.bulkWrite(ops)
  }
  return { scanned: leases.length, changed: ops.length }
}
