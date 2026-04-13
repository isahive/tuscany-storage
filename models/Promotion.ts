import mongoose, { Schema, Document } from 'mongoose'

export interface IPromotionDocument extends Document {
  name: string
  description: string
  method: 'manual' | 'promo_code' | 'automatic'
  promoCode: string
  discountType: 'percentage' | 'fixed'
  discountValue: number // percentage (0-100) or fixed amount in cents
  unitTypes: string[]   // empty = all unit types
  allUnitTypes: boolean
  startDate: Date
  endDate: Date | null
  beginsImmediately: boolean
  beginsAfterCycles: number  // only used if beginsImmediately is false
  noExpiration: boolean
  durationCycles: number     // number of billing cycles the discount lasts
  status: 'active' | 'retired'
  appliedCount: number
  createdAt: Date
  updatedAt: Date
}

const PromotionSchema = new Schema<IPromotionDocument>(
  {
    name:               { type: String, required: true, trim: true },
    description:        { type: String, default: '' },
    method:             { type: String, enum: ['manual', 'promo_code', 'automatic'], required: true },
    promoCode:          { type: String, default: '', trim: true },
    discountType:       { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    discountValue:      { type: Number, required: true },
    unitTypes:          [{ type: String }],
    allUnitTypes:       { type: Boolean, default: true },
    startDate:          { type: Date, required: true },
    endDate:            { type: Date, default: null },
    beginsImmediately:  { type: Boolean, default: true },
    beginsAfterCycles:  { type: Number, default: 0 },
    noExpiration:       { type: Boolean, default: true },
    durationCycles:     { type: Number, default: 1 },
    status:             { type: String, enum: ['active', 'retired'], default: 'active' },
    appliedCount:       { type: Number, default: 0 },
  },
  { timestamps: true },
)

PromotionSchema.index({ status: 1 })
PromotionSchema.index({ method: 1 })
PromotionSchema.index({ promoCode: 1 })

export default mongoose.models.Promotion ||
  mongoose.model<IPromotionDocument>('Promotion', PromotionSchema)
