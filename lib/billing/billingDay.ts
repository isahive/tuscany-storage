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
