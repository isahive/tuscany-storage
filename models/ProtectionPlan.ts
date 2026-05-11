import mongoose, { Schema, Document } from 'mongoose'

export interface IProtectionPlanDocument extends Document {
  name: string
  coverageAmount: number // cents
  monthlyPrice: number   // cents
  description: string
  displayOrder: number
  status: 'active' | 'retired'
  appliedCount: number
  createdAt: Date
  updatedAt: Date
}

const ProtectionPlanSchema = new Schema<IProtectionPlanDocument>(
  {
    name:           { type: String, required: true, trim: true },
    coverageAmount: { type: Number, required: true },
    monthlyPrice:   { type: Number, required: true },
    description:    { type: String, default: '' },
    displayOrder:   { type: Number, default: 0 },
    status:         { type: String, enum: ['active', 'retired'], default: 'active' },
    appliedCount:   { type: Number, default: 0 },
  },
  { timestamps: true },
)

ProtectionPlanSchema.index({ status: 1 })
ProtectionPlanSchema.index({ displayOrder: 1 })

export default mongoose.models.ProtectionPlan ||
  mongoose.model<IProtectionPlanDocument>('ProtectionPlan', ProtectionPlanSchema)
