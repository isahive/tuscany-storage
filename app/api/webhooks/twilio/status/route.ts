import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Notification from '@/models/Notification'

/**
 * Twilio Programmable Messaging status callback.
 *
 * Twilio POSTs `application/x-www-form-urlencoded` with at least:
 *   MessageSid, MessageStatus (queued|sent|delivered|undelivered|failed),
 *   ErrorCode (optional, when failed/undelivered)
 *
 * Configure this URL via TWILIO_STATUS_CALLBACK_URL (used in lib/twilio.ts)
 * or directly on the Messaging Service in the Twilio console.
 *
 * Production hardening:
 *   - Verify the X-Twilio-Signature header using TWILIO_AUTH_TOKEN and the
 *     full request URL (see twilio.validateRequest).
 *   - Rate-limit by IP (Twilio publishes its outbound IP ranges).
 * Demo accepts any payload so a live SID can be plugged later without code.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const messageSid = form.get('MessageSid')?.toString()
    const messageStatus = form.get('MessageStatus')?.toString()
    const errorCode = form.get('ErrorCode')?.toString()

    if (!messageSid || !messageStatus) {
      return NextResponse.json({ success: false, error: 'Missing MessageSid or MessageStatus' }, { status: 400 })
    }

    await connectDB()

    const update: Record<string, unknown> = {}
    switch (messageStatus) {
      case 'delivered':
        update.status = 'sent'
        update.deliveredAt = new Date()
        break
      case 'undelivered':
        update.status = 'undelivered'
        update.bouncedAt = new Date()
        update.bounceReason = `Twilio error ${errorCode ?? 'unknown'}`
        break
      case 'failed':
        update.status = 'failed'
        update.failureReason = `Twilio error ${errorCode ?? 'unknown'}`
        break
      case 'sent':
      case 'queued':
        // Intermediate states — keep our 'sent' status as-is. Just timestamp.
        update.sentAt = new Date()
        break
      default:
        return NextResponse.json({ success: true, ignored: messageStatus })
    }

    await Notification.updateOne({ twilioMessageSid: messageSid }, { $set: update })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[Twilio Status Webhook]', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
