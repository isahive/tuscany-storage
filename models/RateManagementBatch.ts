import mongoose, { Schema, Document, Types } from 'mongoose'

/**
 * One persistent row per "Submit Changes" click on the Rate Management
 * Summary page. Storable's Batches page reads from this collection — each row
 * captures who clicked it, the notification channels chosen, and the bundle
 * of street-rate and rental changes the click produced.
 *
 * Rental changes are normalized into separate `RateChange` rows (which the
 * execution cron applies on the effective date); the batch keeps a pointer
 * to them so the detail page can render the bundle.
 */
export type BatchNotifChannel = 'email' | 'text' | 'print'
export type BatchStatus = 'submitted' | 'partially_cancelled' | 'cancelled'
/** Storable lists both rule-driven Rate Management batches AND ad-hoc
 *  "Mass Edit Rental Prices" batches on the same Batches page. The source
 *  field keeps them distinguishable for filtering. */
export type BatchSource = 'rate_management' | 'mass_edit'

export interface IRateManagementBatchDocument extends Document {
  createdBy: string                 // admin display name or email
  createdAt: Date
  updatedAt: Date
  source: BatchSource
  status: BatchStatus
  notifChannels: BatchNotifChannel[]
  // Unit-type changes are applied immediately (Unit.price update) — we keep
  // the before/after so the audit trail is preserved even after the unit is
  // mutated.
  unitTypeChanges: Array<{
    unitType: string
    previousPrice: number   // cents
    newPrice: number        // cents
    occupancyAtSubmit: number
    targetOccupancyAfter?: number  // updated rule threshold, when admin opts in
    affectedUnitCount: number
  }>
  // Rental changes link to RateChange rows so cancel/edit flows can mutate
  // them without losing batch membership.
  rentalChanges: Array<{
    rateChangeId: Types.ObjectId
    tenantId: Types.ObjectId
    leaseId: Types.ObjectId
    unitId: Types.ObjectId
    unitNumber: string
    currentRate: number
    proposedRate: number
    notificationDate: Date
    changeDate: Date
    notifSentAt?: Date
    cancelledAt?: Date
  }>
}

const RateManagementBatchSchema = new Schema<IRateManagementBatchDocument>(
  {
    createdBy: { type: String, required: true },
    source: { type: String, enum: ['rate_management', 'mass_edit'], default: 'rate_management', index: true },
    status: { type: String, enum: ['submitted', 'partially_cancelled', 'cancelled'], default: 'submitted' },
    notifChannels: [{ type: String, enum: ['email', 'text', 'print'] }],
    unitTypeChanges: [{
      unitType: { type: String, required: true },
      previousPrice: { type: Number, required: true },
      newPrice: { type: Number, required: true },
      occupancyAtSubmit: { type: Number, required: true },
      targetOccupancyAfter: { type: Number },
      affectedUnitCount: { type: Number, required: true },
    }],
    rentalChanges: [{
      rateChangeId: { type: Schema.Types.ObjectId, ref: 'RateChange', required: true },
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
      leaseId: { type: Schema.Types.ObjectId, ref: 'Lease', required: true },
      unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
      unitNumber: { type: String, required: true },
      currentRate: { type: Number, required: true },
      proposedRate: { type: Number, required: true },
      notificationDate: { type: Date, required: true },
      changeDate: { type: Date, required: true },
      notifSentAt: { type: Date },
      cancelledAt: { type: Date },
    }],
  },
  { timestamps: true },
)

RateManagementBatchSchema.index({ createdAt: -1 })

export default mongoose.models.RateManagementBatch ||
  mongoose.model<IRateManagementBatchDocument>('RateManagementBatch', RateManagementBatchSchema)
