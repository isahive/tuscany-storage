import mongoose, { Schema, Document } from 'mongoose'

export interface IContactNotificationRecipient extends Document {
  email: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const ContactNotificationRecipientSchema = new Schema<IContactNotificationRecipient>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export default mongoose.models.ContactNotificationRecipient ||
  mongoose.model<IContactNotificationRecipient>(
    'ContactNotificationRecipient',
    ContactNotificationRecipientSchema,
  )
