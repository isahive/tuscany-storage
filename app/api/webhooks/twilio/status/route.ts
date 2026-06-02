import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { connectDB } from '@/lib/db'
import Notification from '@/models/Notification'

/**
 * Twilio Programmable Messaging status callback.
 *
 * Twilio POSTs `application/x-www-form-urlencoded` with at least:
 *   MessageSid, MessageStatus (queued|sent|delivered|undelivered|failed),
 *   ErrorCode (optional, when failed/undelivered)
 *
 * Signed via X-Twilio-Signature: base64(HMAC-SHA1(authToken, fullUrl +
 * sorted-concat-form-fields)). We verify it before touching the DB so a
 * forged status can't flip a Notification to 'delivered'. In dev or when
 * TWILIO_AUTH_TOKEN is unset we skip verification (logs a warning).
 */
function buildTwilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  const data = url + sortedKeys.map((k) => k + params[k]).join('')
  return crypto.createHmac('sha1', authToken).update(data).digest('base64')
}

function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  headerSig: string | null,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.warn('[Twilio Status Webhook] TWILIO_AUTH_TOKEN unset — skipping signature verification')
    return true
  }
  if (!headerSig) return false
  const expected = buildTwilioSignature(authToken, url, params)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(headerSig, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    // Build the param map the same way Twilio does for signing — every form
    // field as a string.
    const params: Record<string, string> = {}
    for (const [k, v] of form.entries()) params[k] = v.toString()

    const signatureUrl =
      process.env.TWILIO_STATUS_CALLBACK_URL || req.url
    if (!verifyTwilioSignature(signatureUrl, params, req.headers.get('x-twilio-signature'))) {
      return NextResponse.json({ success: false, error: 'invalid signature' }, { status: 401 })
    }

    const messageSid = params.MessageSid
    const messageStatus = params.MessageStatus
    const errorCode = params.ErrorCode

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
