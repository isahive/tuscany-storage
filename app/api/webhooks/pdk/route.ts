/**
 * Inbound webhook from PDK.
 *
 * PDK pushes events for access activity (`device.request.allowed/denied/
 * unknown`) and physical alarms (`device.alarm.forced`, `device.alarm.propped.
 * on`). We translate the access-activity events into AccessLog rows so the
 * admin dashboard shows the same gate timeline that PDK's console does, and
 * log alarm events for ops surfacing.
 *
 * Auth: PDK signs every webhook delivery with HMAC SHA-1 of the raw body using
 * the `secret` configured at subscription time. The signature arrives in the
 * `X-PDK-SIGNATURE` header. We compare it with a timing-safe equality check
 * against `PDK_WEBHOOK_SECRET`. If the env var is unset we accept (dev mode)
 * but log a warning — production deploys must set it.
 *
 * Always returns 200 on parseable bodies, even when an event references a
 * holder we can't map back to a tenant. Returning 5xx would cause PDK to retry
 * and pile up duplicate AccessLog rows.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import AccessLog from '@/models/AccessLog'

interface PdkWebhookEvent {
  type?: string
  // PDK puts the resource under `data`; fields vary by event type.
  data?: {
    holderId?: string
    deviceId?: string
    granted?: boolean
    reason?: string
    [k: string]: unknown
  }
}

function verifySignature(rawBody: string, headerSig: string | null): boolean {
  const secret = process.env.PDK_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[PDK webhook] PDK_WEBHOOK_SECRET not set — accepting without auth')
    return true
  }
  if (!headerSig) return false
  const expected = crypto.createHmac('sha1', secret).update(rawBody).digest('hex')
  // Both buffers must be equal length for timingSafeEqual; bail if not so a
  // length-mismatched signature can't crash the comparison.
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(headerSig, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('x-pdk-signature')

  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ success: false, error: 'invalid signature' }, { status: 401 })
  }

  let event: PdkWebhookEvent
  try {
    event = JSON.parse(rawBody) as PdkWebhookEvent
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json' }, { status: 400 })
  }

  if (!event.type) {
    return NextResponse.json({ success: false, error: 'missing event type' }, { status: 400 })
  }

  await connectDB()

  switch (event.type) {
    case 'device.request.allowed': {
      const holderId = event.data?.holderId
      if (!holderId) break
      const tenant = await Tenant.findOne({ pdkHolderId: holderId }).select('_id')
      if (!tenant) {
        console.warn(`[PDK webhook] device.request.allowed for unmapped holder ${holderId}`)
        break
      }
      await AccessLog.create({
        tenantId: tenant._id,
        eventType: 'entry',
        gateId: 'entrance',
        source: 'keypad',
        notes: event.data?.reason ?? null,
      })
      break
    }

    case 'device.request.denied':
    case 'device.request.unknown': {
      const holderId = event.data?.holderId
      // `unknown` events have no holderId (credential not recognized); log
      // without tenant attribution by skipping the create entirely. `denied`
      // events do have a holderId.
      if (!holderId) break
      const tenant = await Tenant.findOne({ pdkHolderId: holderId }).select('_id')
      if (!tenant) break
      await AccessLog.create({
        tenantId: tenant._id,
        eventType: 'denied',
        gateId: 'entrance',
        source: 'keypad',
        notes: event.data?.reason ?? null,
      })
      break
    }

    case 'device.alarm.forced':
    case 'device.alarm.propped.on': {
      // Physical alarms have no tenant attribution. Logged for ops; the
      // Notification model requires a tenantId so we don't write one here.
      // A future facility-alerts channel can subscribe to this log line.
      console.warn(`[PDK webhook] ${event.type}: ${JSON.stringify(event.data ?? {})}`)
      break
    }

    // Lifecycle / state-clear events (alarm.cleared, relay/dps state) and
    // anything we don't recognize: accept and drop. The reconcile cron is the
    // safety net for state drift.
    default:
      break
  }

  return NextResponse.json({ success: true })
}
