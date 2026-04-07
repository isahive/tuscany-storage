import mongoose, { Schema, Document, Types } from 'mongoose'
import type { AccessEventType, GateId, AccessSource } from '@/types'

export interface IAccessLogDocument extends Document {
  tenantId: Types.ObjectId
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
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
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
AccessLogSchema.index({ createdAt: -1 })

export default mongoose.models.AccessLog || mongoose.model<IAccessLogDocument>('AccessLog', AccessLogSchema)
