import mongoose, { Schema, Document } from 'mongoose'
import type { TenantRole, TenantStatus } from '@/types'

export interface ITenantDocument extends Document {
  firstName: string
  lastName: string
  email: string
  phone: string
  alternatePhone?: string
  alternateEmail?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  driversLicense?: string
  idPhotoUrl?: string
  password: string
  role: TenantRole
  gateCode?: string
  stripeCustomerId?: string
  defaultPaymentMethodId?: string
  autopayEnabled: boolean
  balance: number
  status: TenantStatus
  smsOptIn: boolean
  referralSource?: string
  createdAt: Date
  updatedAt: Date
}

const TenantSchema = new Schema<ITenantDocument>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    alternatePhone: { type: String },
    alternateEmail: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    driversLicense: { type: String },
    idPhotoUrl: { type: String },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['tenant', 'admin'], default: 'tenant' },
    gateCode: { type: String },
    stripeCustomerId: { type: String },
    defaultPaymentMethodId: { type: String },
    autopayEnabled: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'delinquent', 'locked_out', 'moved_out'],
      default: 'active',
    },
    smsOptIn: { type: Boolean, default: false },
    referralSource: { type: String },
  },
  { timestamps: true }
)

TenantSchema.index({ email: 1 })
TenantSchema.index({ status: 1 })
TenantSchema.index({ stripeCustomerId: 1 })

export default mongoose.models.Tenant || mongoose.model<ITenantDocument>('Tenant', TenantSchema)
