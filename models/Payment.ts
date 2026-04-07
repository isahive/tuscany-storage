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
  createdAt: Date
  updatedAt: Date
}

const PaymentSchema = new Schema<IPaymentDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    leaseId: { type: Schema.Types.ObjectId, ref: 'Lease', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    stripePaymentIntentId: { type: String, required: true },
    stripeChargeId: { type: String },
    amount: { type: Number, required: true }, // cents
    currency: { type: String, default: 'usd' },
    type: {
      type: String,
      enum: ['rent', 'late_fee', 'deposit', 'prorated', 'other'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    attemptCount: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    failureReason: { type: String },
    receiptUrl: { type: String },
    receiptEmailSentAt: { type: Date },
  },
  { timestamps: true }
)

PaymentSchema.index({ tenantId: 1 })
PaymentSchema.index({ leaseId: 1 })
PaymentSchema.index({ status: 1 })
PaymentSchema.index({ stripePaymentIntentId: 1 })

export default mongoose.models.Payment || mongoose.model<IPaymentDocument>('Payment', PaymentSchema)
