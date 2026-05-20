import mongoose, { Schema, Document, Types } from 'mongoose'

/**
 * Storable's "Lock Out Report" rows — one append-only entry per lockout or
 * unlock event, whether triggered by the delinquency cron or by an admin
 * clicking Lock Out / Unlock on the Gate Access page.
 *
 * Approval workflow (Settings.lockoutRequireApprovalAuto / Manual): when
 * approval is required, `approvedAt` stays null so the row stays "pending"
 * on the Lock Out Report until an admin clicks Approve. This is purely an
 * audit gate — the tenant's actual lockout state flips immediately.
 */
export type LockoutEventType = 'locked_out' | 'unlocked'
export type LockoutEventTrigger = 'auto' | 'manual'

export interface ILockoutEventDocument extends Document {
  tenantId: Types.ObjectId
  leaseId?: Types.ObjectId
  unitId?: Types.ObjectId
  unitNumber?: string
  type: LockoutEventType
  trigger: LockoutEventTrigger
  reason?: string
  /** Admin who fired the event (manual) or 'cron' (auto). */
  createdBy: string
  /** When the approval workflow is off, this is stamped at create-time. */
  approvedAt?: Date | null
  approvedBy?: string | null
  createdAt: Date
  updatedAt: Date
}

const LockoutEventSchema = new Schema<ILockoutEventDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    leaseId: { type: Schema.Types.ObjectId, ref: 'Lease' },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    unitNumber: { type: String },
    type: { type: String, enum: ['locked_out', 'unlocked'], required: true },
    trigger: { type: String, enum: ['auto', 'manual'], required: true },
    reason: { type: String, default: '' },
    createdBy: { type: String, required: true },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: String, default: null },
  },
  { timestamps: true },
)

LockoutEventSchema.index({ approvedAt: 1, createdAt: -1 })

export default mongoose.models.LockoutEvent ||
  mongoose.model<ILockoutEventDocument>('LockoutEvent', LockoutEventSchema)
