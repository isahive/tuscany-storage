import mongoose, { Schema, Document } from 'mongoose'

export interface IPasswordResetTokenDocument extends Document {
  tenantId: mongoose.Types.ObjectId
  /** SHA-256 of the raw token. The raw token is only ever shown to the user
   *  in the reset URL — we store the hash so a DB leak can't be used to
   *  reset accounts. */
  tokenHash: string
  expiresAt: Date
  usedAt?: Date
  /** "self" when the tenant clicked Forgot Password, or the admin's tenantId
   *  when issued from the admin panel. Audit-only. */
  issuedBy: 'self' | string
  createdAt: Date
}

const PasswordResetTokenSchema = new Schema<IPasswordResetTokenDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    issuedBy: { type: String, default: 'self' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// Mongo TTL: documents are auto-purged 1 day after they expire, so the
// collection never accumulates stale tokens.
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 })

export default mongoose.models.PasswordResetToken ||
  mongoose.model<IPasswordResetTokenDocument>('PasswordResetToken', PasswordResetTokenSchema)
