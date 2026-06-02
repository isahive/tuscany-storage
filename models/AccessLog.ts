import mongoose, { Schema, Document, Types } from 'mongoose'
import type { AccessEventType, GateId, AccessSource } from '@/types'

export interface IAccessLogDocument extends Document {
  /** Optional — set when the keypad event is attributable to a tenant. A row
   *  MUST have either tenantId or visitorAccessId; the model's pre-validate
   *  hook enforces that. */
  tenantId?: Types.ObjectId
  /** Optional — set when the keypad event was triggered by a temporary
   *  contractor pass (see models/VisitorAccess). */
  visitorAccessId?: Types.ObjectId
  unitId?: Types.ObjectId
  eventType: AccessEventType
  gateId: GateId
  source: AccessSource
  ipAddress?: string
  notes?: string
  createdAt: Date
}

const AccessLogSchema = new Schema<IAccessLogDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    visitorAccessId: { type: Schema.Types.ObjectId, ref: 'VisitorAccess' },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    eventType: {
      type: String,
      enum: ['entry', 'exit', 'denied', 'code_changed'],
      required: true,
    },
    gateId: {
      type: String,
      enum: ['entrance', 'exit', 'unknown'],
      default: 'unknown',
    },
    source: {
      type: String,
      enum: ['keypad', 'app', 'admin', 'system'],
      required: true,
    },
    ipAddress: { type: String },
    notes: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

AccessLogSchema.index({ tenantId: 1 })
AccessLogSchema.index({ visitorAccessId: 1 })
AccessLogSchema.index({ createdAt: -1 })

AccessLogSchema.pre('validate', function () {
  // Keypad events must always resolve to a principal — every PIN at the
  // reader maps to either a tenant or a visitor pass, and an orphan row
  // here means our webhook lost an attribution. Other sources can be
  // principal-less by design: 'system' covers cron-driven state changes
  // and 'app' covers admin-initiated actions like text-to-open where the
  // actor is a whitelisted phone, not a tenant.
  if (this.source === 'keypad' && !this.tenantId && !this.visitorAccessId) {
    this.invalidate('tenantId', 'AccessLog (keypad) requires tenantId or visitorAccessId')
  }
})

export default mongoose.models.AccessLog || mongoose.model<IAccessLogDocument>('AccessLog', AccessLogSchema)
