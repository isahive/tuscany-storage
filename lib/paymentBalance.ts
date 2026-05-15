import type { Model, Types } from 'mongoose'

/**
 * Single source of truth for how a Payment row affects the running balance.
 *
 * Convention (matches Storable Easy's billing-history display):
 *   - Charge rows           → balance += amount (voided charges still count;
 *                             their matching void payment row offsets them).
 *   - Failed/refunded rows  → no change (informational only).
 *   - Other payment rows    → balance -= amount (succeeded, voided, credit).
 */
export interface PaymentBalanceInput {
  direction: 'charge' | 'payment'
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'voided'
  amount: number
}

export function balanceDelta(row: PaymentBalanceInput): number {
  if (row.direction === 'charge') return row.amount
  if (row.status === 'failed' || row.status === 'refunded') return 0
  return -row.amount
}

/**
 * Look up the tenant's most recent Payment.balanceAfter and return what the
 * balanceAfter would be once `row` is applied. Call this right before
 * Payment.create so the new row carries the correct snapshot.
 */
export async function nextBalanceAfter(
  PaymentModel: Model<any>,
  tenantId: string | Types.ObjectId,
  row: PaymentBalanceInput,
): Promise<number> {
  const last = await PaymentModel
    .findOne({ tenantId })
    .sort({ createdAt: -1, _id: -1 })
    .select('balanceAfter')
    .lean<{ balanceAfter?: number }>()
  const prior = last?.balanceAfter ?? 0
  return prior + balanceDelta(row)
}
