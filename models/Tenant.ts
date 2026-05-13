import mongoose, { Schema, Document } from 'mongoose'
import type { TenantRole, TenantStatus } from '@/types'

export interface ITenantBillingAddress {
  line1: string
  city: string
  state: string
  zip: string
  country: string
}

export interface ITenantDocument extends Document {
  firstName: string
  lastName: string
  email: string
  phone: string
  // Primary contact address
  address?: string
  city?: string
  state?: string
  zip?: string
  // Alternate contact (back-up person)
  alternateContactName?: string
  alternatePhone?: string
  alternateEmail?: string
  alternateAddress?: string
  alternateCity?: string
  alternateState?: string
  alternateZip?: string
  // Personal / identification info
  driversLicense?: string
  driversLicenseNumber?: string
  driversLicenseState?: string
  ssn?: string
  employerName?: string
  employerPhone?: string
  emergencyContact?: string
  emergencyPhone?: string
  securityQuestion?: string
  securityAnswer?: string
  idPhotoUrl?: string
  /** When true, the Photo ID is also used as the profile avatar. */
  idPhotoIsProfile?: boolean
  // Auth & ops
  password: string
  username?: string
  loginDisabled?: boolean
  role: TenantRole
  gateCode?: string
  stripeCustomerId?: string
  defaultPaymentMethodId?: string
  autopayEnabled: boolean
  /** Days after due date before recurring billing auto-charges. 0 = same day. */
  billingDateOffset?: number
  balance: number
  status: TenantStatus
  smsOptIn: boolean
  smsConsent?: boolean
  referralSource?: string
  howDidYouHear?: string
  howDidYouHearOther?: string
  billingAddress?: ITenantBillingAddress
  /** Bag for admin-defined custom fields (key from /admin/settings/form-fields → value). */
  customFields?: Record<string, string>
  // Notes / accounting flags
  taxExempt?: boolean
  lateFeeExempt?: boolean
  invoiceNote?: string
  notes?: string
  // Lifecycle flags (mutually exclusive with active rentals)
  archived?: boolean
  onWaitingList?: boolean
  createdAt: Date
  updatedAt: Date
}

const TenantSchema = new Schema<ITenantDocument>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    alternateContactName: { type: String },
    alternatePhone: { type: String },
    alternateEmail: { type: String },
    alternateAddress: { type: String },
    alternateCity: { type: String },
    alternateState: { type: String },
    alternateZip: { type: String },
    driversLicense: { type: String },
    driversLicenseNumber: { type: String },
    driversLicenseState: { type: String },
    ssn: { type: String },
    employerName: { type: String },
    employerPhone: { type: String },
    emergencyContact: { type: String },
    emergencyPhone: { type: String },
    securityQuestion: { type: String },
    securityAnswer: { type: String },
    idPhotoUrl: { type: String },
    idPhotoIsProfile: { type: Boolean, default: false },
    customFields: { type: Map, of: String, default: {} },
    password: { type: String, required: true, select: false },
    username: { type: String, trim: true },
    loginDisabled: { type: Boolean, default: false },
    role: { type: String, enum: ['tenant', 'admin'], default: 'tenant' },
    gateCode: { type: String },
    stripeCustomerId: { type: String },
    defaultPaymentMethodId: { type: String },
    autopayEnabled: { type: Boolean, default: false },
    billingDateOffset: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'delinquent', 'locked_out', 'moved_out'],
      default: 'active',
    },
    smsOptIn: { type: Boolean, default: false },
    smsConsent: { type: Boolean, default: false },
    referralSource: { type: String },
    howDidYouHear: { type: String },
    howDidYouHearOther: { type: String },
    billingAddress: {
      line1: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
      country: { type: String },
    },
    taxExempt:      { type: Boolean, default: false },
    lateFeeExempt:  { type: Boolean, default: false },
    invoiceNote:    { type: String, default: '' },
    notes:          { type: String, default: '' },
    archived:       { type: Boolean, default: false },
    onWaitingList:  { type: Boolean, default: false },
  },
  { timestamps: true }
)

TenantSchema.index({ status: 1 })
TenantSchema.index({ stripeCustomerId: 1 })

export default mongoose.models.Tenant || mongoose.model<ITenantDocument>('Tenant', TenantSchema)
