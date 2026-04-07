import mongoose, { Schema, Document, Types } from 'mongoose'
import type { UnitType, UnitFloor, UnitStatus } from '@/types'

export interface IUnitDocument extends Document {
  unitNumber: string
  size: string
  width: number
  depth: number
  sqft: number
  type: UnitType
  floor: UnitFloor
  price: number
  status: UnitStatus
  features: string[]
  currentTenantId?: Types.ObjectId
  currentLeaseId?: Types.ObjectId
  notes?: string
  gridX?: number
  gridY?: number
  gridFloor?: number
  createdAt: Date
  updatedAt: Date
}

const UnitSchema = new Schema<IUnitDocument>(
  {
    unitNumber: { type: String, required: true, unique: true, trim: true },
    size: { type: String, required: true },
    width: { type: Number, required: true },
    depth: { type: Number, required: true },
    sqft: { type: Number, required: true },
    type: {
      type: String,
      enum: ['standard', 'climate_controlled', 'drive_up', 'vehicle_outdoor'],
      required: true,
    },
    floor: { type: String, enum: ['ground', 'upper'], required: true },
    price: { type: Number, required: true }, // cents
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance', 'reserved'],
      default: 'available',
    },
    features: [{ type: String }],
    currentTenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    currentLeaseId: { type: Schema.Types.ObjectId, ref: 'Lease' },
    notes: { type: String },
    gridX: { type: Number },
    gridY: { type: Number },
    gridFloor: { type: Number, default: 1 },
  },
  { timestamps: true }
)

UnitSchema.index({ status: 1 })
UnitSchema.index({ type: 1 })
UnitSchema.index({ unitNumber: 1 })

export default mongoose.models.Unit || mongoose.model<IUnitDocument>('Unit', UnitSchema)
