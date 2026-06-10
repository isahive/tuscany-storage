import mongoose, { Schema, Document, Types } from 'mongoose'
import type { UnitType, UnitStatus } from '@/types'

export interface IUnitDocument extends Document {
  unitNumber: string
  size: string
  width: number
  depth: number
  sqft: number
  type: UnitType
  price: number
  status: UnitStatus
  features: string[]
  /** Multiple price points shown on the unit page (e.g. promo + standard). */
  pricingOptions?: Array<{ amount: number; intervalMonths: number }>
  /** Default deposit charged at move-in. Cents. */
  defaultDeposit?: number
  /** One-time fee charged at move-in. Cents. */
  defaultSetupFee?: number
  /** Total quoted at reservation. Cents. */
  reservationPrice?: number
  /** Display name of admin who created the unit — fed to the audit footer. */
  createdByName?: string
  /** Display name of admin who last edited the unit. */
  updatedByName?: string
  currentTenantId?: Types.ObjectId
  currentLeaseId?: Types.ObjectId
  notes?: string
  gridX?: number
  gridY?: number
  gridFloor?: number
  gridRotation?: 0 | 90
  // Reservation fields — populated when status='reserved'
  reservedTenantId?: Types.ObjectId
  reservedAt?: Date
  reservedMoveInDate?: Date
  reservedPrice?: number   // cents
  /** Stripe PaymentIntent that captured the reservation fee. Needed for
   *  refund-on-cancel and for the deposit-credit on first-invoice conversion. */
  reservationPaymentIntentId?: string
  /** Cents actually charged for the reservation fee — recorded separately
   *  from `reservedPrice` so admins can adjust the displayed price without
   *  losing the audit trail of what the customer actually paid. */
  reservationFeePaid?: number
  reservationFeePaidAt?: Date
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
    price: { type: Number, required: true }, // cents
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance', 'reserved'],
      default: 'available',
    },
    features: [{ type: String }],
    pricingOptions: {
      type: [
        {
          amount: { type: Number, required: true },
          intervalMonths: { type: Number, default: 1 },
        },
      ],
      default: [],
    },
    defaultDeposit: { type: Number, default: 0 },
    defaultSetupFee: { type: Number, default: 0 },
    reservationPrice: { type: Number, default: 0 },
    createdByName: { type: String },
    updatedByName: { type: String },
    currentTenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    currentLeaseId: { type: Schema.Types.ObjectId, ref: 'Lease' },
    notes: { type: String },
    gridX: { type: Number },
    gridY: { type: Number },
    gridFloor: { type: Number, default: 1 },
    gridRotation: { type: Number, enum: [0, 90], default: 0 },
    reservedTenantId:   { type: Schema.Types.ObjectId, ref: 'Tenant' },
    reservedAt:         { type: Date },
    reservedMoveInDate: { type: Date },
    reservedPrice:      { type: Number },
    reservationPaymentIntentId: { type: String },
    reservationFeePaid:         { type: Number },
    reservationFeePaidAt:       { type: Date },
  },
  { timestamps: true }
)

UnitSchema.index({ status: 1 })
UnitSchema.index({ type: 1 })

export default mongoose.models.Unit || mongoose.model<IUnitDocument>('Unit', UnitSchema)
