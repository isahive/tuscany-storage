import mongoose, { Schema, Document, Types } from 'mongoose'

export type MoveOutRequestStatus = 'pending' | 'approved' | 'denied'

export interface IMoveOutRequestDocument extends Document {
  tenantId: Types.ObjectId
  leaseId: Types.ObjectId
  unitId: Types.ObjectId
  requestedMoveOutDate: Date
  stripePaymentMethodConfirmed: boolean
  lastFourDigits?: string
  photoUrls: string[]
  guidelines: string
  status: MoveOutRequestStatus
  adminNotes?: string
  reviewedBy?: Types.ObjectId
  reviewedAt?: Date
  notificationSentAt?: Date
  createdAt: Date
  updatedAt: Date
}

const MoveOutRequestSchema = new Schema<IMoveOutRequestDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    leaseId: {
      type: Schema.Types.ObjectId,
      ref: 'Lease',
      required: true,
    },
    unitId: {
      type: Schema.Types.ObjectId,
      ref: 'Unit',
      required: true,
    },
    requestedMoveOutDate: {
      type: Date,
      required: true,
    },
    stripePaymentMethodConfirmed: {
      type: Boolean,
      default: false,
    },
    lastFourDigits: {
      type: String,
      trim: true,
    },
    photoUrls: {
      type: [String],
      default: [],
    },
    guidelines: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied'],
      default: 'pending',
    },
    adminNotes: {
      type: String,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant', // admin who reviewed
    },
    reviewedAt: {
      type: Date,
    },
    notificationSentAt: {
      type: Date,
    },
  },
  { timestamps: true },
)

MoveOutRequestSchema.index({ tenantId: 1 })
MoveOutRequestSchema.index({ leaseId: 1 })
MoveOutRequestSchema.index({ unitId: 1 })
MoveOutRequestSchema.index({ status: 1 })
MoveOutRequestSchema.index({ requestedMoveOutDate: 1 })

export default mongoose.models.MoveOutRequest ||
  mongoose.model<IMoveOutRequestDocument>('MoveOutRequest', MoveOutRequestSchema)
