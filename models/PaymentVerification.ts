import mongoose, { Schema, Document } from 'mongoose'

/**
 * Tracks anti-fraud counters per tenant or per admin so payment endpoints can
 * enforce Storable Easy's "Web Visitor Verification" behavior:
 *   1) 5 failed payments in a row                  -> CAPTCHA on next attempt
 *   2) Payment attempted without an active rental  -> CAPTCHA on next attempt
 *   3) Make-a-Payment opened 5x without a success  -> CAPTCHA on next attempt
 *   4) >3 successful manual admin charges in 1h    -> CAPTCHA on next attempt
 *
 * One document per `key`. Keys are namespaced — `tenant:<id>` for tenant-side
 * triggers, `admin:<id>` for admin-side. Same model serves both so admins
 * doing legitimate work don't share counters with the tenants they charge.
 */
export interface IPaymentVerificationDocument extends Document {
  key: string
  failedPaymentStreak: number
  screenOpensSinceSuccess: number
  recentManualCharges: Date[]
  verificationRequiredUntil?: Date | null
  verificationReason?: string | null
  updatedAt: Date
}

const PaymentVerificationSchema = new Schema<IPaymentVerificationDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    failedPaymentStreak: { type: Number, default: 0 },
    screenOpensSinceSuccess: { type: Number, default: 0 },
    recentManualCharges: { type: [Date], default: [] },
    verificationRequiredUntil: { type: Date, default: null },
    verificationReason: { type: String, default: null },
  },
  { timestamps: true },
)

export default mongoose.models.PaymentVerification ||
  mongoose.model<IPaymentVerificationDocument>('PaymentVerification', PaymentVerificationSchema)
