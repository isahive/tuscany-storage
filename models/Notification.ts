import mongoose, { Schema, Document, Types } from 'mongoose'
import type { NotificationType, NotificationChannel, NotificationStatus } from '@/types'

export interface INotificationDocument extends Document {
  tenantId: Types.ObjectId
  type: NotificationType
  channel: NotificationChannel
  subject?: string
  body: string
  status: NotificationStatus
  sentAt?: Date
  // Delivery telemetry — populated by webhook handlers from Resend (email)
  // and Twilio (SMS). Stays undefined for channels without webhooks
  // configured, so absence means "we don't know" rather than "didn't happen".
  deliveredAt?: Date
  bouncedAt?: Date
  bounceReason?: string
  openedAt?: Date
  failureReason?: string
  twilioMessageSid?: string
  resendMessageId?: string
  templateName?: string
  eventKey?: string
  createdAt: Date
  updatedAt: Date
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    type: {
      type: String,
      enum: [
        'payment_reminder', 'payment_confirmation', 'payment_failed',
        'late_notice', 'lockout_notice', 'gate_code_changed',
        'move_in_confirmation', 'move_out_confirmation',
        'rate_change_notice', 'waiting_list_available', 'custom',
      ],
      required: true,
    },
    channel: {
      type: String,
      enum: ['email', 'sms', 'both'],
      required: true,
    },
    subject: { type: String },
    body: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'undelivered'],
      default: 'pending',
    },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    bouncedAt: { type: Date },
    bounceReason: { type: String },
    openedAt: { type: Date },
    failureReason: { type: String },
    twilioMessageSid: { type: String },
    resendMessageId: { type: String },
    templateName: { type: String },
    eventKey: { type: String },
  },
  { timestamps: true }
)

NotificationSchema.index({ tenantId: 1 })
NotificationSchema.index({ status: 1 })
NotificationSchema.index({ type: 1 })
NotificationSchema.index({ eventKey: 1 }, { sparse: true })
NotificationSchema.index({ resendMessageId: 1 }, { sparse: true })
NotificationSchema.index({ twilioMessageSid: 1 }, { sparse: true })

export default mongoose.models.Notification || mongoose.model<INotificationDocument>('Notification', NotificationSchema)
