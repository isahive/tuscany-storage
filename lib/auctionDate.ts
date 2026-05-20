/**
 * Storable Easy "Automatic Auction Dates" — pure helper that decides when a
 * tenant's auction date should be set when they hit the Locked Out step.
 *
 * Two configurations live on Settings (under the Locked Out rule):
 *   - auctionDaysAfterLockout — calendar-days offset from lockedOutAt
 *   - auctionFixedDate        — admin-pinned absolute calendar date
 *
 * The pinned date wins when set (Storable lets admins schedule a single
 * future auction batch and have every new lockout roll into the same date).
 * When neither is configured, the helper returns null and the caller leaves
 * the auction date alone.
 */

export interface AuctionDateSettings {
  auctionDaysAfterLockout?: number
  auctionFixedDate?: Date | string | null
}

export function computeAuctionDate(
  lockedOutAt: Date,
  settings: AuctionDateSettings,
): Date | null {
  // Fixed date wins. Storable shows it as a single calendar pinner that
  // batches all in-progress lockouts to a common sale day.
  if (settings.auctionFixedDate) {
    const fixed = new Date(settings.auctionFixedDate)
    if (!Number.isNaN(fixed.getTime())) {
      // Only use the fixed date if it's still in the future relative to the
      // lockout (otherwise it's stale config from a prior auction batch and
      // we fall back to the per-tenant offset).
      if (fixed.getTime() > lockedOutAt.getTime()) return fixed
    }
  }

  const days = settings.auctionDaysAfterLockout
  if (typeof days !== 'number' || days <= 0) return null

  const out = new Date(lockedOutAt)
  out.setDate(out.getDate() + days)
  return out
}
