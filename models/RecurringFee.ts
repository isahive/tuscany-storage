import mongoose, { Schema, Document, Types } from 'mongoose'

export type RecurringFeeInterval = 'monthly' | 'yearly'

/** Manual fee categories shown in the dropdown — matches Storable Easy live. */
export const MANUAL_FEE_CATEGORIES = [
  'Rent',
  'Balance Forward',
  'Returned check fee',
  'Cut Lock',
  'Late Fee',
  'Certified Letter',
  'Advertisement Fee',
  'Auction Fee',
] as const
export type ManualFeeCategory = (typeof MANUAL_FEE_CATEGORIES)[number]

export interface IRecurringFeeDocument extends Document {
  tenantId: Types.ObjectId
  /** One of MANUAL_FEE_CATEGORIES, or empty when customCategory is used. */
  category?: ManualFeeCategory | ''
  /** Free-text category override (mutually exclusive with category in the UI). */
  customCategory?: string
  startDate: Date
  interval: RecurringFeeInterval
  /** Cents. */
  amount: number
  /** Percentage (e.g. 9.75). 0 = "Don't Charge Tax". */
  taxRate: number
  /** When true, the recurring-billing cron charges the active payment account
   *  on each due date once start date has passed. */
  chargeOnDueDate: boolean
  description?: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const RecurringFeeSchema = new Schema<IRecurringFeeDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    category: { type: String, default: '' },
    customCategory: { type: String, default: '' },
    startDate: { type: Date, required: true },
    interval: { type: String, enum: ['monthly', 'yearly'], required: true, default: 'monthly' },
    amount: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    chargeOnDueDate: { type: Boolean, default: true },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

RecurringFeeSchema.index({ tenantId: 1, active: 1 })

export default mongoose.models.RecurringFee ||
  mongoose.model<IRecurringFeeDocument>('RecurringFee', RecurringFeeSchema)
