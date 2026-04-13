import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ITextMessageDocument extends Document {
  tenantId: Types.ObjectId
  phone: string
  message: string
  direction: 'outbound' | 'inbound'
  sender: string  // 'System' or admin name
  twilioSid?: string
  status: 'sent' | 'delivered' | 'failed' | 'received'
  createdAt: Date
}

const TextMessageSchema = new Schema<ITextMessageDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    phone: { type: String, required: true },
    message: { type: String, required: true },
    direction: { type: String, enum: ['outbound', 'inbound'], default: 'outbound' },
    sender: { type: String, default: 'System' },
    twilioSid: { type: String },
    status: { type: String, enum: ['sent', 'delivered', 'failed', 'received'], default: 'sent' },
  },
  { timestamps: true }
)

TextMessageSchema.index({ tenantId: 1, createdAt: -1 })

export default mongoose.models.TextMessage || mongoose.model<ITextMessageDocument>('TextMessage', TextMessageSchema)
