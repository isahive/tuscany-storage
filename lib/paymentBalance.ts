import type { ClientSession, Model, Types } from 'mongoose'

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
 * The tenant's current running balance — the most recent Payment.balanceAfter,
 * or 0 if they have no rows yet. Pass `session` to read inside a transaction so
 * the value is consistent with concurrent writes in the same unit of work.
 */
export async function priorBalanceAfter(
  PaymentModel: Model<any>,
  tenantId: string | Types.ObjectId,
  session?: ClientSession,
): Promise<number> {
  const last = await PaymentModel
    .findOne({ tenantId })
    .sort({ createdAt: -1, _id: -1 })
    .select('balanceAfter')
    .session(session ?? null)
    .lean<{ balanceAfter?: number }>()
  return last?.balanceAfter ?? 0
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
  session?: ClientSession,
): Promise<number> {
  return (await priorBalanceAfter(PaymentModel, tenantId, session)) + balanceDelta(row)
}

export interface ChargeInput {
  tenantId: string | Types.ObjectId
  leaseId?: string | Types.ObjectId
  unitId?: string | Types.ObjectId
  amount: number
  type: 'rent' | 'late_fee' | 'deposit' | 'prorated' | 'credit' | 'other'
  stripePaymentIntentId: string
  status?: 'pending' | 'succeeded'
  description?: string
  periodStart?: Date
  periodEnd?: Date
  createdBy?: string
  attemptCount?: number
}

/**
 * Create a charge Payment row AND keep tenant.balance in sync with the ledger.
 *
 * `tenant.balance` is a denormalized cache of the running ledger; every charge
 * must bump it or the two drift apart. The cron jobs (invoices, delinquency)
 * historically created charge rows without updating tenant.balance, which is
 * exactly what put cron-applied late fees out of sync with the billing-history
 * ledger. Routing all charge creation through here — mirroring the interactive
 * charge route's create-then-increment pattern — makes every source behave
 * identically and prevents the drift from recurring. Returns the row's
 * balanceAfter snapshot.
 */
export async function recordCharge(
  PaymentModel: Model<any>,
  TenantModel: Model<any>,
  charge: ChargeInput,
  session?: ClientSession,
): Promise<{ balanceAfter: number }> {
  const status = charge.status ?? 'pending'
  const delta = balanceDelta({ direction: 'charge', status, amount: charge.amount })
  const balanceAfter = (await priorBalanceAfter(PaymentModel, charge.tenantId, session)) + delta

  await PaymentModel.create(
    [{
      tenantId: charge.tenantId,
      leaseId: charge.leaseId,
      unitId: charge.unitId,
      stripePaymentIntentId: charge.stripePaymentIntentId,
      amount: charge.amount,
      currency: 'usd',
      type: charge.type,
      status,
      direction: 'charge',
      balanceAfter,
      periodStart: charge.periodStart,
      periodEnd: charge.periodEnd,
      description: charge.description,
      createdBy: charge.createdBy,
      attemptCount: charge.attemptCount ?? 0,
    }],
    session ? { session } : {},
  )

  await TenantModel.updateOne(
    { _id: charge.tenantId },
    { $inc: { balance: delta } },
    session ? { session } : {},
  )

  return { balanceAfter }
}
