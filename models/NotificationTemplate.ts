import mongoose, { Schema, Document } from 'mongoose'

export interface INotificationTemplateDocument extends Document {
  name: string
  type: 'default' | 'custom'
  // Content
  emailSubject: string
  emailContent: string  // HTML with placeholders
  textContent: string   // Plain text with placeholders
  postcardContent: string // HTML for postcard format
  // Channels enabled
  emailEnabled: boolean
  textEnabled: boolean
  printEnabled: boolean
  // Automation rule (for custom templates used in Late/Lien)
  rule: 'late' | 'pre_lien' | 'lien' | 'auction' | 'manual' | null
  daysPastDue: number | null  // triggers at this many days past due
  // Description
  description: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const NotificationTemplateSchema = new Schema<INotificationTemplateDocument>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['default', 'custom'], default: 'custom' },
    emailSubject: { type: String, default: '' },
    emailContent: { type: String, default: '' },
    textContent: { type: String, default: '' },
    postcardContent: { type: String, default: '' },
    emailEnabled: { type: Boolean, default: true },
    textEnabled: { type: Boolean, default: false },
    printEnabled: { type: Boolean, default: false },
    rule: { type: String, enum: ['late', 'pre_lien', 'lien', 'auction', 'manual', null], default: 'manual' },
    daysPastDue: { type: Number, default: null },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.models.NotificationTemplate || mongoose.model<INotificationTemplateDocument>('NotificationTemplate', NotificationTemplateSchema)
