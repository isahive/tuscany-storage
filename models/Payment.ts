import mongoose, { Schema, Document, Types } from 'mongoose'
import type { PaymentType, PaymentStatus, PaymentDirection } from '@/types'

export interface IPaymentDocument extends Document {
  tenantId: Types.ObjectId
  leaseId: Types.ObjectId
  unitId: Types.ObjectId
  stripePaymentIntentId: string
  stripeChargeId?: string
  amount: number
  currency: 'usd'
  type: PaymentType
  status: PaymentStatus
  // 'charge' = billing line item the tenant owes; 'payment' = money received,
  // refunded, or credited. Determines Charges vs Payments/Voids column.
  direction: PaymentDirection
  // Tenant's running balance (cents, signed) right after this row was applied.
  // Persisted so the capped billing-history view shows correct per-row balance
  // without re-walking the entire ledger on every render.
  balanceAfter: number
  periodStart: Date
  periodEnd: Date
  attemptCount: number
  lastAttemptAt?: Date
  failureReason?: string
  receiptUrl?: string
  receiptEmailSentAt?: Date
  description?: string  // admin-entered memo (used for credits/manual entries)
  createdBy?: string    // admin user id who recorded the entry
  dueDate?: Date        // when manual charges (fees/products) are due
  autoChargeOnDueDate?: boolean // if true, recurring-billing cron charges on dueDate
  taxRate?: number      // percentage (e.g. 9.75) applied on this line
  /** Name on the card used for the payment — captured when it differs from the
   *  tenant (family member, employer, etc). Preserved from the live CSV. */
  cardholderName?: string
  /** Human label of the payment instrument, e.g. "Visa *8300". */
  paymentMethodLabel?: string
  /** Source system the row came from (e.g. "storable-csv-2026-05-14"). */
  importSource?: string
  /** Idempotency key for auto-generated recurring rent charges:
   *  `${leaseId}:${dueDate YYYY-MM-DD}:rent`. A sparse unique index makes the
   *  recurring-billing cron's pre-charge claim fail instead of issuing a second
   *  Stripe charge when two sweeps overlap. Only set on cron-claimed rows;
   *  cleared when an attempt fails so the next run can retry. */
  billingPeriodKey?: string
  /** When direction='payment', the charge rows this payment was applied
   *  against. Lets the Refund Payment screen list the underlying line items
   *  the way Storable Easy does (multi-item refund). */
  appliedToItemIds?: Types.ObjectId[]
  /** When direction='payment' status='refunded', the original payment row
   *  this refund row reverses. Lets the billing history pair them up. */
  refundOfPaymentId?: Types.ObjectId
  /** Free-form reason captured at refund time (Storable parity). */
  refundReason?: string
  /** Refund method chosen on the Refund screen — return_to_card, cash, check,
   *  other — separate from `description` so reports can group cleanly. */
  refundMethod?: 'return_to_card' | 'cash' | 'check' | 'other'
  createdAt: Date
  updatedAt: Date
}

const PaymentSchema = new Schema<IPaymentDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    // leaseId/unitId optional: manual credits/adjustments may not tie to a specific lease.
    leaseId: { type: Schema.Types.ObjectId, ref: 'Lease' },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    // Optional for manual entries (credits, fees) — required for actual Stripe charges.
    stripePaymentIntentId: { type: String },
    stripeChargeId: { type: String },
    amount: { type: Number, required: true }, // cents
    currency: { type: String, default: 'usd' },
    type: {
      type: String,
      enum: ['rent', 'late_fee', 'deposit', 'prorated', 'credit', 'other'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded', 'voided'],
      default: 'pending',
    },
    direction: {
      type: String,
      enum: ['charge', 'payment'],
      default: 'charge',
      required: true,
      index: true,
    },
    balanceAfter: { type: Number, default: 0 },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    attemptCount: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    failureReason: { type: String },
    receiptUrl: { type: String },
    receiptEmailSentAt: { type: Date },
    description: { type: String },
    createdBy: { type: String },
    dueDate: { type: Date },
    autoChargeOnDueDate: { type: Boolean, default: false },
    taxRate: { type: Number, default: 0 },
    cardholderName: { type: String },
    paymentMethodLabel: { type: String },
    importSource: { type: String, index: true },
    billingPeriodKey: { type: String },
    appliedToItemIds: [{ type: Schema.Types.ObjectId, ref: 'Payment' }],
    refundOfPaymentId: { type: Schema.Types.ObjectId, ref: 'Payment', index: true },
    refundReason: { type: String },
    refundMethod: { type: String, enum: ['return_to_card', 'cash', 'check', 'other'] },
  },
  { timestamps: true }
)

PaymentSchema.index({ tenantId: 1 })
PaymentSchema.index({ leaseId: 1 })
PaymentSchema.index({ status: 1 })
PaymentSchema.index({ stripePaymentIntentId: 1 })
// One live auto-charge per lease+period. Sparse so it only constrains rows the
// recurring-billing cron claims — historical imports and manual payments (no
// billingPeriodKey) are untouched.
PaymentSchema.index({ billingPeriodKey: 1 }, { unique: true, sparse: true })

export default mongoose.models.Payment || mongoose.model<IPaymentDocument>('Payment', PaymentSchema)
