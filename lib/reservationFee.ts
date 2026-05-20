/**
 * Pure helpers for Storable Easy's per-unit-type reservation fee.
 *
 * The amount lives on Settings.unitTypeReservationFees as
 *   [{ unitType, amount }]  // amount in cents
 *
 * Look-ups are tolerant — zero amount, missing row, and missing unit type all
 * resolve to "no fee" so callers can branch on a single boolean.
 *
 * Refund math follows the spec: if the reservation is cancelled before the
 * unit converts to a rental, the full deposit comes back. Once the rental
 * starts, the deposit becomes a non-refundable credit on the first invoice.
 */

export interface UnitTypeReservationFee {
  unitType: string
  amount: number // cents
}

export function feeForUnitType(
  unitType: string | undefined | null,
  fees: UnitTypeReservationFee[] | undefined | null,
): number {
  if (!unitType || !fees) return 0
  const row = fees.find((f) => f.unitType === unitType)
  return row && row.amount > 0 ? row.amount : 0
}

export function isReservationFeeEnabled(
  unitType: string | undefined | null,
  fees: UnitTypeReservationFee[] | undefined | null,
): boolean {
  return feeForUnitType(unitType, fees) > 0
}

/**
 * Storable parity: cancel before move-in → full refund; cancel after the
 * reservation converted to an active lease → no refund (the deposit became
 * a credit on the first invoice). Caller passes `convertedToLease` to signal
 * which state the reservation is in.
 */
export function refundAmountForCancel(args: {
  paidAmount: number
  convertedToLease: boolean
}): number {
  if (args.convertedToLease) return 0
  return Math.max(0, args.paidAmount)
}

/**
 * The credit line Storable shows on the first rental invoice when a paid
 * reservation converts. Cents in, cents out — so callers can pass the
 * pre-tax monthly rent (or whatever first-invoice line they want to offset).
 */
export function reservationDepositCredit(paidReservationFee: number): number {
  return Math.max(0, paidReservationFee)
}

// ─── Convenience labels for the public-facing modal ──────────────────────────

/** Spec copy verbatim — referenced in tests so a rephrase trips a regression. */
export const RESERVATION_DEPOSIT_COPY =
  'The Reservation Deposit is the deposit amount needed to reserve a unit and the full amount will be credited back on the first rental invoice.'
