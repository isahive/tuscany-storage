import mongoose, { Schema, Document, Types } from 'mongoose'

/**
 * Append-only ledger of every change to a product's on-hand quantity.
 * Storable Easy's "Change Inventory" form writes one row per action; sales
 * write one row per fulfillment so the Retail Inventory Summary report can
 * reconstruct stock over any date range.
 *
 * Quantities are SIGNED — Received rows are positive, Adjustments may be
 * positive or negative, Sales are always negative.
 */
export type InventoryAction = 'received' | 'adjustment' | 'sale'

export interface IInventoryAdjustmentDocument extends Document {
  productId: Types.ObjectId
  action: InventoryAction
  quantity: number      // signed
  reason?: string
  /** Stock after this adjustment was applied — denormalized so the report
   *  doesn't have to walk the ledger to compute running totals. */
  inventoryAfter: number
  // Sale-specific links (Storable shows the tenant on the report row).
  tenantId?: Types.ObjectId
  paymentId?: Types.ObjectId
  /** Display name of the admin who recorded the change. */
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const InventoryAdjustmentSchema = new Schema<IInventoryAdjustmentDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    action: { type: String, enum: ['received', 'adjustment', 'sale'], required: true },
    quantity: { type: Number, required: true },
    reason: { type: String, default: '' },
    inventoryAfter: { type: Number, required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
)

InventoryAdjustmentSchema.index({ productId: 1, createdAt: -1 })

export default mongoose.models.InventoryAdjustment ||
  mongoose.model<IInventoryAdjustmentDocument>('InventoryAdjustment', InventoryAdjustmentSchema)
