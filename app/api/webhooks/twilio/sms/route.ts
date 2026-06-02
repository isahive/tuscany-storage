/**
 * Inbound SMS webhook from Twilio. Implements text-to-open: a whitelisted
 * phone texts the Tuscany Twilio number → backend fires momentary unlock
 * across every configured entry device → PDK opens the gate.
 *
 * Auth: Twilio signs every webhook with HMAC-SHA1 of (request_url + sorted
 * POST params), keyed by the account's auth token. Header:
 *   X-Twilio-Signature: base64(hmac-sha1(url + flattenParams, authToken))
 *
 * Reply: TwiML XML. Always reply with the same generic message so the
 * sender can't distinguish "not authorized" from "no devices configured" —
 * prevents number-enumeration / device-config probing via SMS.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { handleTextToOpen } from '@/lib/textToOpen'

const TWIML_OK = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Gate opening.</Message></Response>`
const TWIML_DENIED = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, this number is not authorized.</Message></Response>`
const TWIML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`

function twiml(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

/**
 * Twilio signs `url + sorted(key+value concat)` with HMAC-SHA1 keyed by the
 * account auth token. The url is the EXACT public URL Twilio called — for
 * us that's TWILIO_WEBHOOK_URL (https://<host>/api/webhooks/twilio/sms),
 * NOT the local request.url which may be http://localhost during dev.
 *
 * Dev mode (TWILIO_AUTH_TOKEN unset) accepts without verification and warns.
 * Production MUST have the env var set; otherwise anyone could spoof an
 * "open the gate" payload.
 */
function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.warn('[Twilio webhook] TWILIO_AUTH_TOKEN not set — accepting without auth')
    return true
  }
  if (!signature) return false

  // Sort keys alphabetically + concat key+value pairs, prepend the url.
  const sortedKeys = Object.keys(params).sort()
  let data = url
  for (const k of sortedKeys) data += k + params[k]

  const expected = crypto.createHmac('sha1', authToken).update(data).digest('base64')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  // Twilio sends application/x-www-form-urlencoded.
  const raw = await req.text()
  const params: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v

  const webhookUrl = process.env.TWILIO_WEBHOOK_URL
    || `${req.nextUrl.protocol}//${req.nextUrl.host}${req.nextUrl.pathname}`
  const signature = req.headers.get('x-twilio-signature')

  if (!verifyTwilioSignature(webhookUrl, params, signature)) {
    return NextResponse.json(
      { success: false, error: 'invalid signature' },
      { status: 401 },
    )
  }

  const from = params.From ?? ''
  const messageSid = params.MessageSid ?? params.SmsSid

  if (!from) {
    return twiml(TWIML_EMPTY, 400)
  }

  try {
    const result = await handleTextToOpen({ from, messageSid })
    if (!result.authorized) {
      return twiml(TWIML_DENIED)
    }
    if (result.rejection === 'no_devices_configured' || result.rejection === 'pdk_disabled') {
      // Authorized but the system isn't ready to act. Reply generically so
      // an admin testing finds out via the logs, not the SMS reply.
      return twiml(TWIML_DENIED)
    }
    return twiml(TWIML_OK)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Twilio webhook] handleTextToOpen failed: ${msg}`)
    return twiml(TWIML_EMPTY, 500)
  }
}
