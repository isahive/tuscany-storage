import mongoose, { Schema, Document, Types } from 'mongoose'

export type RateChangeStatus = 'proposed' | 'approved' | 'rejected' | 'executed'

export interface IRateChangeDocument extends Document {
  tenantId: Types.ObjectId
  leaseId: Types.ObjectId
  unitId: Types.ObjectId
  currentRate: number    // cents at time of proposal
  proposedRate: number   // cents
  effectiveDate: Date    // when the change should apply
  status: RateChangeStatus
  occupancyRate?: number // % occupancy of unit type at proposal time
  tenureMonths?: number
  rejectionReason?: string
  approvedBy?: Types.ObjectId
  approvedAt?: Date
  noticeSentAt?: Date
  executedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const RateChangeSchema = new Schema<IRateChangeDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    leaseId: { type: Schema.Types.ObjectId, ref: 'Lease', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    currentRate: { type: Number, required: true },
    proposedRate: { type: Number, required: true },
    effectiveDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['proposed', 'approved', 'rejected', 'executed'],
      default: 'proposed',
    },
    occupancyRate: { type: Number },
    tenureMonths: { type: Number },
    rejectionReason: { type: String },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    approvedAt: { type: Date },
    noticeSentAt: { type: Date },
    executedAt: { type: Date },
  },
  { timestamps: true },
)

RateChangeSchema.index({ status: 1, effectiveDate: 1 })
RateChangeSchema.index({ leaseId: 1, status: 1 })

export default mongoose.models.RateChange ||
  mongoose.model<IRateChangeDocument>('RateChange', RateChangeSchema)
