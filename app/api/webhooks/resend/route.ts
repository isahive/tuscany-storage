import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Notification from '@/models/Notification'

/**
 * Resend email-event webhook.
 *
 * Resend POSTs JSON like:
 *   { "type": "email.delivered", "created_at": "...", "data": { "email_id": "<id>", "to": [...] } }
 *
 * The `data.email_id` matches the id we persist in `Notification.resendMessageId`
 * when the email is sent (see lib/sendNotification.ts).
 *
 * Production hardening to wire before going live:
 *   - Verify the `svix-id`, `svix-timestamp`, `svix-signature` headers against
 *     RESEND_WEBHOOK_SECRET using the @svix/webhooks package.
 *   - Replay-protect by checking the timestamp window (±5 minutes).
 * For the demo we accept any payload so Jess can plug a live secret later
 * without code changes.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const eventType: string | undefined = body?.type
    const emailId: string | undefined = body?.data?.email_id

    if (!eventType || !emailId) {
      return NextResponse.json({ success: false, error: 'Missing type or email_id' }, { status: 400 })
    }

    await connectDB()

    const update: Record<string, unknown> = {}
    switch (eventType) {
      case 'email.delivered':
        update.status = 'sent'
        update.deliveredAt = new Date()
        break
      case 'email.bounced':
        update.status = 'undelivered'
        update.bouncedAt = new Date()
        update.bounceReason = typeof body?.data?.bounce?.reason === 'string'
          ? body.data.bounce.reason
          : 'Email bounced'
        break
      case 'email.complained':
        update.bouncedAt = new Date()
        update.bounceReason = 'Recipient marked as spam'
        break
      case 'email.opened':
        update.openedAt = new Date()
        break
      case 'email.delivery_delayed':
        update.failureReason = 'Delivery delayed'
        break
      default:
        // Unknown event types are acknowledged but not persisted — Resend keeps
        // adding new ones (email.clicked, etc.) and we don't want to 500 them.
        return NextResponse.json({ success: true, ignored: eventType })
    }

    await Notification.updateOne({ resendMessageId: emailId }, { $set: update })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[Resend Webhook]', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
