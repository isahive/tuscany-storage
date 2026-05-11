import mongoose, { Schema, Document, Types } from 'mongoose'
import type { LeaseStatus } from '@/types'

export interface ILeaseDocument extends Document {
  tenantId: Types.ObjectId
  unitId: Types.ObjectId
  startDate: Date
  endDate?: Date
  moveOutDate?: Date
  monthlyRate: number
  deposit: number
  proratedFirstMonth: number
  billingDay: number
  status: LeaseStatus
  leaseDocumentUrl?: string
  signedAt?: Date
  signatureData?: string
  signatureType?: 'drawn' | 'typed'
  appliedPromotionId?: Types.ObjectId
  protectionPlanId?: Types.ObjectId
  lastRateChangeDate?: Date
  auctionDate?: Date
  auctionScheduledAt?: Date
  createdAt: Date
  updatedAt: Date
}

const LeaseSchema = new Schema<ILeaseDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    moveOutDate: { type: Date },
    monthlyRate: { type: Number, required: true }, // cents
    deposit: { type: Number, required: true, default: 0 }, // cents
    proratedFirstMonth: { type: Number, required: true, default: 0 }, // cents
    billingDay: { type: Number, required: true, min: 1, max: 28 },
    status: {
      type: String,
      enum: ['active', 'ended', 'pending_moveout'],
      default: 'active',
    },
    leaseDocumentUrl: { type: String },
    signedAt: { type: Date },
    signatureData: { type: String },
    signatureType: { type: String, enum: ['drawn', 'typed'] },
    appliedPromotionId: { type: Schema.Types.ObjectId, ref: 'Promotion' },
    protectionPlanId: { type: Schema.Types.ObjectId, ref: 'ProtectionPlan' },
    lastRateChangeDate: { type: Date },
    auctionDate: { type: Date },
    auctionScheduledAt: { type: Date },
  },
  { timestamps: true }
)

LeaseSchema.index({ tenantId: 1 })
LeaseSchema.index({ unitId: 1 })
LeaseSchema.index({ status: 1 })

export default mongoose.models.Lease || mongoose.model<ILeaseDocument>('Lease', LeaseSchema)
