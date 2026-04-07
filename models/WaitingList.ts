import mongoose, { Schema, Document, Types } from 'mongoose'
import type { WaitingListStatus } from '@/types'

export interface IWaitingListDocument extends Document {
  name: string
  email: string
  phone: string
  preferredSize: string
  preferredType?: string
  desiredMoveInDate?: Date
  notes?: string
  status: WaitingListStatus
  notifiedAt?: Date
  notifiedUnitId?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const WaitingListSchema = new Schema<IWaitingListDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    preferredSize: { type: String, required: true },
    preferredType: { type: String },
    desiredMoveInDate: { type: Date },
    notes: { type: String },
    status: {
      type: String,
      enum: ['waiting', 'notified', 'converted', 'expired'],
      default: 'waiting',
    },
    notifiedAt: { type: Date },
    notifiedUnitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
  },
  { timestamps: true }
)

WaitingListSchema.index({ status: 1 })
WaitingListSchema.index({ email: 1 })

export default mongoose.models.WaitingList || mongoose.model<IWaitingListDocument>('WaitingList', WaitingListSchema)
