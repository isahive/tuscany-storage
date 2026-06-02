import mongoose, { Schema, Document } from 'mongoose'

/**
 * Time-bound gate access for non-tenants (contractors, electricians, plumbers,
 * appraisers, deliveries). A VisitorAccess is its own aggregate — distinct
 * lifecycle from Tenant — because:
 *
 *   - It's ephemeral; the local DB knows the validity window, PDK does NOT
 *     (the PDK Holder schema rejects activation/expiration timestamps as of
 *     2026 — confirmed via scripts/pdk-probe-expiration.ts).
 *   - It has its own audit trail (issued/revoked/expired by whom and when).
 *   - It joins a dedicated "Tuscany Visitors" group in PDK, so visitor
 *     activity is auditable separately from tenants in PDK reports.
 *
 * Status machine:
 *
 *   active   — within [validFrom, validUntil), PDK holder exists+enabled
 *   expired  — clock crossed validUntil; cron deletes the holder
 *   revoked  — admin cancelled before validUntil; cron/service deletes
 *
 * The cron (`jobs/visitor-access-expiration.ts`) is the source of truth for
 * enforcement: even if PDK panel state drifts, the cron deletes the holder
 * when validUntil passes. Server-side enforcement is the OWASP defense-in-
 * depth layer — never trust the PDK panel alone to expire the credential.
 */

export type VisitorAccessStatus = 'active' | 'expired' | 'revoked'

export interface IVisitorAccessDocument extends Document {
  /** Display name shown in PDK + admin UI. Capped at 35 chars (PDK firstName limit). */
  name: string
  /** Free-text reason for the visit — e.g. "Electrician", "HVAC repair". */
  purpose: string
  /** Inclusive window start. Defaults to createdAt. */
  validFrom: Date
  /** Exclusive window end. Must be > validFrom. */
  validUntil: Date
  /** Plaintext 6-digit PIN. We DO NOT hash it because PDK needs the raw value
   *  to push to the panel; access to the document is admin-only. */
  pin: string
  /** Holder id once provisioned. Empty during the brief window between
   *  document creation and PDK round-trip (or always-empty if PDK is off). */
  pdkHolderId?: string
  status: VisitorAccessStatus
  /** Admin email who issued the pass. */
  createdBy: string
  /** When the holder was actually pushed to PDK. */
  pdkSyncedAt?: Date
  /** Stamped when status flips to 'revoked'. */
  revokedAt?: Date
  revokedBy?: string
  /** Stamped when status flips to 'expired' by the cron. */
  expiredAt?: Date
  createdAt: Date
  updatedAt: Date
}

const VisitorAccessSchema = new Schema<IVisitorAccessDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 35,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    validFrom: { type: Date, required: true, default: () => new Date() },
    validUntil: { type: Date, required: true },
    pin: {
      type: String,
      required: true,
      match: /^\d{4,8}$/,
    },
    pdkHolderId: { type: String, index: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked'],
      default: 'active',
      required: true,
    },
    createdBy: { type: String, required: true, trim: true },
    pdkSyncedAt: { type: Date },
    revokedAt: { type: Date },
    revokedBy: { type: String, trim: true },
    expiredAt: { type: Date },
  },
  { timestamps: true },
)

// Cron sweeps for status='active' AND validUntil <= now.
VisitorAccessSchema.index({ status: 1, validUntil: 1 })
// PIN uniqueness only for currently-active passes — expired/revoked PINs are
// fine to coexist historically. Partial index keeps the constraint useful
// without forcing the collection to be globally unique on a recycled PIN.
VisitorAccessSchema.index(
  { pin: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
)
VisitorAccessSchema.index({ createdAt: -1 })

VisitorAccessSchema.pre('validate', function () {
  if (this.validUntil && this.validFrom && this.validUntil <= this.validFrom) {
    this.invalidate('validUntil', 'validUntil must be strictly after validFrom')
  }
})

export default mongoose.models.VisitorAccess
  || mongoose.model<IVisitorAccessDocument>('VisitorAccess', VisitorAccessSchema)
