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
  /** Extra gate-access cards/fobs (numeric IDs, never starting with 0). */
  additionalCards?: string[]
  /** Gate groups the customer belongs to (e.g. "Managers 24/7", "Renters"). */
  gateGroups?: string[]
  /** Optional auction date recorded on the manual lock-out form. */
  lockoutAuctionDate?: Date
  /** Free-text note saved on the manual lock-out form. */
  lockoutNote?: string
  /** When true (default), tenant is auto-locked after `automaticLockoutDays` of unpaid rent. */
  automaticLockoutEnabled?: boolean
  /** Days unpaid before auto-lockout fires (Storable default = 9). */
  automaticLockoutDays?: number
  /** Timestamp the tenant's gate access was last revoked. Powers the
   *  "Locked out on …" line shown on the unit detail page. */
  lockedOutAt?: Date
  stripeCustomerId?: string
  defaultPaymentMethodId?: string
  /** Stripe `fingerprint` of the default payment method. Cached so the
   *  duplicate-tenant scanner can match cards locally without hitting Stripe. */
  cardFingerprint?: string
  /** Tenants the operator confirmed are the same human (bidirectional). */
  linkedTenantIds?: mongoose.Types.ObjectId[]
  /** Pair-ids the operator marked as "not a duplicate" so the scanner skips them. */
  dismissedMatchIds?: mongoose.Types.ObjectId[]
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
  /** Skip ALL Late/Lien notifications (email/text/print) for this tenant.
   *  Storable recommends pairing this with lateFeeExempt when an admin
   *  exempts a tenant entirely from the delinquency workflow. */
  lateLienNotificationsDisabled?: boolean
  invoiceNote?: string
  notes?: string
  // Lifecycle flags (mutually exclusive with active rentals)
  archived?: boolean
  onWaitingList?: boolean
  /** Synthetic tenant used to record retail walk-in sales — never has a real
   *  rental or payment method. There's exactly one of these per facility. */
  isRetailWalkIn?: boolean
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
    additionalCards: { type: [String], default: [] },
    gateGroups: { type: [String], default: [] },
    lockoutAuctionDate: { type: Date },
    lockoutNote: { type: String },
    automaticLockoutEnabled: { type: Boolean, default: true },
    automaticLockoutDays: { type: Number, default: 9, min: 0 },
    lockedOutAt: { type: Date },
    stripeCustomerId: { type: String },
    defaultPaymentMethodId: { type: String },
    cardFingerprint: { type: String },
    linkedTenantIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Tenant' }], default: [] },
    dismissedMatchIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Tenant' }], default: [] },
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
    lateLienNotificationsDisabled: { type: Boolean, default: false },
    invoiceNote:    { type: String, default: '' },
    notes:          { type: String, default: '' },
    archived:       { type: Boolean, default: false },
    onWaitingList:  { type: Boolean, default: false },
    isRetailWalkIn: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

TenantSchema.index({ status: 1 })
TenantSchema.index({ stripeCustomerId: 1 })
TenantSchema.index({ cardFingerprint: 1 })
TenantSchema.index({ linkedTenantIds: 1 })

TenantSchema.pre('save', async function () {
  if (!this.isModified('defaultPaymentMethodId')) return
  const { syncCardFingerprint } = await import('@/lib/cardFingerprint')
  await syncCardFingerprint(this)
})

export default mongoose.models.Tenant || mongoose.model<ITenantDocument>('Tenant', TenantSchema)
