import mongoose, { Schema, Document } from 'mongoose'

export interface ISettingsDocument extends Document {
  // Facility
  facilityName: string
  facilityAddress: string
  facilityCity: string
  facilityState: string
  facilityZip: string
  facilityPhone: string
  facilityEmail: string

  // Access hours
  accessHoursStart: string // "05:00"
  accessHoursEnd: string   // "22:00"

  // Fees (all in cents)
  lateFeeAfterDays: number   // default 5
  lateFeeAmount: number      // default 2000 ($20)
  nsfFeeAmount: number       // default 3500 ($35)
  auctionFeeAmount: number   // default 5000 ($50)

  // Agreement
  agreementTemplate: string  // full text with [[PLACEHOLDER]] tokens

  createdAt: Date
  updatedAt: Date
}

const SettingsSchema = new Schema<ISettingsDocument>(
  {
    facilityName: { type: String, default: 'Tuscany Village Self Storage' },
    facilityAddress: { type: String, default: '' },
    facilityCity: { type: String, default: '' },
    facilityState: { type: String, default: 'TN' },
    facilityZip: { type: String, default: '' },
    facilityPhone: { type: String, default: '(865) 426-2100' },
    facilityEmail: { type: String, default: '' },
    accessHoursStart: { type: String, default: '05:00' },
    accessHoursEnd: { type: String, default: '22:00' },
    lateFeeAfterDays: { type: Number, default: 5 },
    lateFeeAmount: { type: Number, default: 2000 },
    nsfFeeAmount: { type: Number, default: 3500 },
    auctionFeeAmount: { type: Number, default: 5000 },
    agreementTemplate: { type: String, default: '' },
  },
  { timestamps: true },
)

export default mongoose.models.Settings ||
  mongoose.model<ISettingsDocument>('Settings', SettingsSchema)
