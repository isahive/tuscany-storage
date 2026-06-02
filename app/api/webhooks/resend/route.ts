import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
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
 * Auth: Svix-style. Header `svix-signature` carries one or more
 * `v1,<base64-hmac-sha256>` tokens; we recompute HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}` using the secret from
 * RESEND_WEBHOOK_SECRET (stored as `whsec_<base64>`). We also bound the
 * timestamp to ±5 min to prevent replays. If RESEND_WEBHOOK_SECRET is unset
 * we skip verification (logs a warning).
 */
const REPLAY_WINDOW_SECONDS = 5 * 60

function verifySvixSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[Resend Webhook] RESEND_WEBHOOK_SECRET unset — skipping signature verification')
    return true
  }
  if (!svixId || !svixTimestamp || !svixSignature) return false

  // Replay protection — drop signatures outside a 5-minute window.
  const ts = parseInt(svixTimestamp, 10)
  if (Number.isNaN(ts)) return false
  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - ts) > REPLAY_WINDOW_SECONDS) return false

  // Svix secrets are stored as `whsec_<base64>`. Strip the prefix.
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(signedPayload)
    .digest('base64')

  // Header may contain multiple versioned signatures: `v1,<sig> v1,<sig2>`
  // — accept if any matches.
  const presented = svixSignature.split(' ')
  for (const entry of presented) {
    const parts = entry.split(',')
    if (parts.length !== 2 || parts[0] !== 'v1') continue
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(parts[1], 'utf8')
    if (a.length !== b.length) continue
    if (crypto.timingSafeEqual(a, b)) return true
  }
  return false
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    if (
      !verifySvixSignature(
        rawBody,
        req.headers.get('svix-id'),
        req.headers.get('svix-timestamp'),
        req.headers.get('svix-signature'),
      )
    ) {
      return NextResponse.json({ success: false, error: 'invalid signature' }, { status: 401 })
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ success: false, error: 'invalid json' }, { status: 400 })
    }
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
