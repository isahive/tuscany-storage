/**
 * Pure helpers for Storable Easy's Lockout module — feeKey computation +
 * approval-workflow predicates. Kept free of mongoose so vitest can hit
 * every branch.
 */

/**
 * One-time-per-lockout-episode fee key for Late/Lien events with
 * status='locked_out'. Embeds the `lockedOutAt` timestamp so the same
 * physical lockout doesn't double-charge, but a future re-lockout (after a
 * payment-driven restore) produces a fresh key and the fee applies again.
 *
 * Non-locked-out events recur monthly and use a separate yyyy-mm key path
 * (see jobs/delinquency.ts).
 */
export function lockoutFeeKey(args: {
  leaseId: string
  eventId: string
  feeName: string
  lockedOutAt: Date
}): string {
  return `latelienfee:${args.leaseId}:${args.eventId}:${args.feeName}:lockout:${args.lockedOutAt.toISOString()}`
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
