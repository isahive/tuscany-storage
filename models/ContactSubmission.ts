import mongoose, { Schema, Document } from 'mongoose'

export interface IContactSubmissionDocument extends Document {
  name: string
  email: string
  phone: string
  subject: string
  message: string
  status: 'new' | 'read' | 'replied'
  repliedAt?: Date
  repliedBy?: string
  createdAt: Date
  updatedAt: Date
}

const ContactSubmissionSchema = new Schema<IContactSubmissionDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ['new', 'read', 'replied'], default: 'new' },
    repliedAt: { type: Date },
    repliedBy: { type: String },
  },
  { timestamps: true }
)

ContactSubmissionSchema.index({ status: 1, createdAt: -1 })

export default mongoose.models.ContactSubmission || mongoose.model<IContactSubmissionDocument>('ContactSubmission', ContactSubmissionSchema)
