import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IPrintBatchDocument extends Document {
  items: Array<{
    tenantId: Types.ObjectId
    unitNumber: string
    documentType: string  // 'invoice' | 'past_due_notice' | 'lockout_notice' | 'foreclosure_notice' | etc
    balance: number
  }>
  format: 'letter' | 'postcard'
  status: 'created' | 'printed'
  printedAt?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const PrintBatchSchema = new Schema<IPrintBatchDocument>(
  {
    items: [{
      tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
      unitNumber: { type: String, required: true },
      documentType: { type: String, required: true },
      balance: { type: Number, default: 0 },
    }],
    format: { type: String, enum: ['letter', 'postcard'], default: 'letter' },
    status: { type: String, enum: ['created', 'printed'], default: 'created' },
    printedAt: { type: Date },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
)

export default mongoose.models.PrintBatch || mongoose.model<IPrintBatchDocument>('PrintBatch', PrintBatchSchema)
