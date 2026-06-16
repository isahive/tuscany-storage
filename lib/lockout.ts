/**
 * Pure helpers for Storable Easy's Lockout module — feeKey computation +
 * approval-workflow predicates. Kept free of mongoose so vitest can hit
 * every branch.
 */

export type LateLienStatus = 'late' | 'locked_out' | 'pre_lien' | 'lien' | 'auction'

/**
 * Storable parity: "The late/lien event repeats every month, resending the
 * notifications and processing a late fee. The lock-out rules and later
 * events only occur once." We encode that here by choosing the dedupe key
 * shape based on the event's status.
 *
 *   - Late: per-billing-period key (yyyy-mm) so it re-fires every month.
 *   - Locked Out / Pre-Lien / Lien / Auction: per-lockout-episode key
 *     embedding the tenant's `lockedOutAt`. Same lockout never re-fires; a
 *     future re-lockout (new lockedOutAt) produces a fresh key.
 *
 * Both the notification eventKey and the per-event fee key use the same
 * decision rule so the audit trail stays internally consistent.
 *
 * `lockedOutAt` may be omitted only for Late status. For non-Late statuses
 * we fall back to epoch-zero so callers that haven't yet stamped lockedOutAt
 * still get a deterministic — but stable — key.
 */
export function lateLienEventKey(args: {
  leaseId: string
  eventId: string
  status: LateLienStatus
  periodStart: Date
  lockedOutAt?: Date | null
}): string {
  if (args.status === 'late') {
    const yyyy = args.periodStart.getFullYear()
    const mm = String(args.periodStart.getMonth() + 1).padStart(2, '0')
    return `delinquency:${args.leaseId}:${args.eventId}:${yyyy}-${mm}`
  }
  const stamp = (args.lockedOutAt ?? new Date(0)).toISOString()
  return `delinquency:${args.leaseId}:${args.eventId}:episode:${stamp}`
}

/**
 * One-time-per-lockout-episode fee key. Embeds the `lockedOutAt` timestamp
 * so the same physical lockout doesn't double-charge, but a future re-
 * lockout produces a fresh key and the fee applies again.
 */
export function lockoutFeeKey(args: {
  leaseId: string
  eventId: string
  feeName: string
  lockedOutAt: Date
}): string {
  return `latelienfee:${args.leaseId}:${args.eventId}:${args.feeName}:episode:${args.lockedOutAt.toISOString()}`
}

/**
 * Same status-aware split for per-event fees: Late events use the monthly
 * key, everything else uses the per-lockout-episode key.
 */
export function lateLienFeeKey(args: {
  leaseId: string
  eventId: string
  feeName: string
  status: LateLienStatus
  periodStart: Date
  lockedOutAt?: Date | null
}): string {
  if (args.status === 'late') {
    const yyyy = args.periodStart.getFullYear()
    const mm = String(args.periodStart.getMonth() + 1).padStart(2, '0')
    return `latelienfee:${args.leaseId}:${args.eventId}:${args.feeName}:${yyyy}-${mm}`
  }
  return lockoutFeeKey({
    leaseId: args.leaseId,
    eventId: args.eventId,
    feeName: args.feeName,
    lockedOutAt: args.lockedOutAt ?? new Date(0),
  })
}

/**
 * Approval-workflow decision: given Settings flags + the event being
 * recorded, should `approvedAt` be stamped now (auto-approved) or left null
 * for a human to sign off later?
 */
export function shouldAutoApprove(args: {
  type: 'locked_out' | 'unlocked'
  trigger: 'auto' | 'manual'
  settings: {
    lockoutRequireApprovalAuto?: boolean
    lockoutRequireApprovalManual?: boolean
  }
}): boolean {
  // Storable only gates UNLOCKS — lockouts always auto-approve because the
  // facility is presumed to physically place the overlock at trigger time.
  if (args.type === 'locked_out') return true
  if (args.trigger === 'auto') return !args.settings.lockoutRequireApprovalAuto
  return !args.settings.lockoutRequireApprovalManual
}

/**
 * Cross-source late-fee dedupe. The cron's own idempotency key only catches
 * rows it created itself, so it would happily stack a second late fee on top
 * of one already imported from Storable (or applied by the other cron path)
 * for the same billing month.
 *
 * This predicate answers: does `rows` already contain a late-fee-like charge
 * whose EFFECTIVE month matches the billing month of `billingPeriodStart`?
 *
 * "Late-fee-like" = a `late_fee` charge (canonical; Storable imports land here)
 * or an `other` charge whose description equals the configured fee name (the
 * cron's own per-event Past Due Fee). Effective month uses `periodStart` when
 * present and falls back to `createdAt` — imported Storable late fees carry a
 * null `periodStart`, which is exactly the gap that let duplicates through.
 */
export function hasLateFeeForBillingMonth(
  rows: Array<{
    type?: string
    direction?: string
    description?: string | null
    periodStart?: Date | string | null
    createdAt?: Date | string | null
  }>,
  billingPeriodStart: Date,
  feeName: string,
): boolean {
  const year = billingPeriodStart.getFullYear()
  const month = billingPeriodStart.getMonth()
  return rows.some((r) => {
    if (r.direction !== 'charge') return false
    const isLateFeeLike = r.type === 'late_fee' || (r.type === 'other' && r.description === feeName)
    if (!isLateFeeLike) return false
    const effective = r.periodStart ?? r.createdAt
    if (!effective) return false
    const d = new Date(effective)
    return d.getFullYear() === year && d.getMonth() === month
  })
}
