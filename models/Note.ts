import mongoose, { Schema, Document, Types } from 'mongoose'

export interface INoteDocument extends Document {
  tenantId: Types.ObjectId
  content: string
  attachmentUrl?: string
  attachmentName?: string
  createdBy: string // admin name or "System"
  createdAt: Date
  updatedAt: Date
}

const NoteSchema = new Schema<INoteDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    content: { type: String, required: true },
    attachmentUrl: { type: String },
    attachmentName: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
)

NoteSchema.index({ tenantId: 1, createdAt: -1 })

export default mongoose.models.Note || mongoose.model<INoteDocument>('Note', NoteSchema)
