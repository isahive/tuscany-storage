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
