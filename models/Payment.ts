import mongoose, { Schema, Document, Types } from 'mongoose'
import type { PaymentType, PaymentStatus } from '@/types'

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
      enum: ['pending', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
    },
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
  },
  { timestamps: true }
)

PaymentSchema.index({ tenantId: 1 })
PaymentSchema.index({ leaseId: 1 })
PaymentSchema.index({ status: 1 })
PaymentSchema.index({ stripePaymentIntentId: 1 })

export default mongoose.models.Payment || mongoose.model<IPaymentDocument>('Payment', PaymentSchema)
