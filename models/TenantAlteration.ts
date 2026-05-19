import mongoose, { Schema, Document, Types } from 'mongoose'

/**
 * Append-only audit row for tenant-level changes that Storable Easy surfaces
 * on the "Tenant Alterations" page. Promotion add/remove is the immediate
 * driver; other change types (rate edits, plan swaps, etc.) can reuse the
 * same model so the audit screen stays one query.
 */
export type AlterationAction =
  | 'promotion_added'
  | 'promotion_removed'
  | 'rate_changed'
  | 'plan_changed'
  | 'note_added'

export interface ITenantAlterationDocument extends Document {
  tenantId: Types.ObjectId
  leaseId?: Types.ObjectId
  unitId?: Types.ObjectId
  unitNumber?: string
  action: AlterationAction
  // Free-form payload — for promotion_* it captures promotionId, promotionName,
  // method; for rate_changed it captures previousRate/newRate; etc.
  payload: Record<string, unknown>
  // Display name of the user (admin/sales) who triggered the change. Storable
  // shows this verbatim in the audit list.
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const TenantAlterationSchema = new Schema<ITenantAlterationDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    leaseId: { type: Schema.Types.ObjectId, ref: 'Lease' },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit' },
    unitNumber: { type: String },
    action: {
      type: String,
      enum: ['promotion_added', 'promotion_removed', 'rate_changed', 'plan_changed', 'note_added'],
      required: true,
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
)

TenantAlterationSchema.index({ tenantId: 1, createdAt: -1 })

export default mongoose.models.TenantAlteration ||
  mongoose.model<ITenantAlterationDocument>('TenantAlteration', TenantAlterationSchema)
