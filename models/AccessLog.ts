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
  // Every row must be attributable to exactly one principal — either a
  // tenant or a visitor pass. Prevents orphan rows from sneaking in if a
  // future caller forgets both ids.
  if (!this.tenantId && !this.visitorAccessId) {
    this.invalidate('tenantId', 'AccessLog requires tenantId or visitorAccessId')
  }
})

export default mongoose.models.AccessLog || mongoose.model<IAccessLogDocument>('AccessLog', AccessLogSchema)
