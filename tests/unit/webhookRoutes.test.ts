import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import crypto from 'crypto'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import Notification from '@/models/Notification'
import { POST as resendWebhook } from '@/app/api/webhooks/resend/route'
import { POST as twilioWebhook } from '@/app/api/webhooks/twilio/status/route'

function jsonRequest(body: unknown) {
  return new Request('http://localhost/wh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function formRequest(form: Record<string, string>) {
  const fd = new URLSearchParams()
  for (const [k, v] of Object.entries(form)) fd.set(k, v)
  return new Request('http://localhost/wh', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: fd.toString(),
  })
}

describe('POST /api/webhooks/resend', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('400s when type is missing', async () => {
    const res = await resendWebhook(jsonRequest({ data: { email_id: 'x' } }) as any)
    expect(res.status).toBe(400)
  })

  it('400s when email_id is missing', async () => {
    const res = await resendWebhook(jsonRequest({ type: 'email.delivered' }) as any)
    expect(res.status).toBe(400)
  })

  it('records deliveredAt on email.delivered', async () => {
    const t = await makeTenant()
    const n = await Notification.create({
      tenantId: t._id,
      type: 'payment_reminder',
      channel: 'email',
      subject: 'x', body: 'x',
      status: 'sent', sentAt: new Date(),
      resendMessageId: 're-msg-1',
    })

    const res = await resendWebhook(jsonRequest({
      type: 'email.delivered',
      data: { email_id: 're-msg-1' },
    }) as any)
    expect(res.status).toBe(200)
    const after = await Notification.findById(n._id) as any
    expect(after.deliveredAt).toBeInstanceOf(Date)
  })

  it('returns 200 even when no matching notification exists (idempotent)', async () => {
    const res = await resendWebhook(jsonRequest({
      type: 'email.delivered',
      data: { email_id: 'unknown-id' },
    }) as any)
    expect(res.status).toBe(200)
  })

  it('marks notification undelivered on email.bounced', async () => {
    const t = await makeTenant()
    const n = await Notification.create({
      tenantId: t._id,
      type: 'payment_reminder',
      channel: 'email',
      subject: 'x', body: 'x',
      status: 'sent', sentAt: new Date(),
      resendMessageId: 're-bounce',
    })
    await resendWebhook(jsonRequest({
      type: 'email.bounced',
      data: { email_id: 're-bounce', bounce: { reason: 'mailbox full' } },
    }) as any)
    const after = await Notification.findById(n._id) as any
    expect(after.status).toBe('undelivered')
    expect(after.bounceReason).toMatch(/mailbox full/)
  })
})

describe('POST /api/webhooks/twilio/status', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('400s without MessageSid + MessageStatus', async () => {
    const res = await twilioWebhook(formRequest({}) as any)
    expect(res.status).toBe(400)
  })

  it('stamps deliveredAt when MessageStatus=delivered', async () => {
    const t = await makeTenant()
    const n = await Notification.create({
      tenantId: t._id,
      type: 'payment_reminder',
      channel: 'sms',
      subject: 'sms', body: 'sms',
      status: 'sent', sentAt: new Date(),
      twilioMessageSid: 'SM-1',
    })
    const res = await twilioWebhook(formRequest({ MessageSid: 'SM-1', MessageStatus: 'delivered' }) as any)
    expect(res.status).toBe(200)
    const after = await Notification.findById(n._id) as any
    expect(after.deliveredAt).toBeInstanceOf(Date)
  })

  it('records failed status with errorCode', async () => {
    const t = await makeTenant()
    const n = await Notification.create({
      tenantId: t._id,
      type: 'payment_reminder',
      channel: 'sms',
      subject: 'sms', body: 'sms',
      status: 'sent', sentAt: new Date(),
      twilioMessageSid: 'SM-fail',
    })
    await twilioWebhook(formRequest({ MessageSid: 'SM-fail', MessageStatus: 'failed', ErrorCode: '30003' }) as any)
    const after = await Notification.findById(n._id)
    expect(after!.status).toBe('failed')
  })

  it('returns 200 even when no matching notification exists', async () => {
    const res = await twilioWebhook(formRequest({ MessageSid: 'SM-unknown', MessageStatus: 'delivered' }) as any)
    expect(res.status).toBe(200)
  })
})

// ─── Signature verification (added after audit) ──────────────────────────────

describe('POST /api/webhooks/twilio/status — signature verification', () => {
  const SAVED_ENV = { ...process.env }
  beforeAll(async () => { await startTestDb() })
  afterAll(async () => { await stopTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    process.env = { ...SAVED_ENV }
  })

  function signedTwilioReq(url: string, params: Record<string, string>, authToken: string) {
    const sortedKeys = Object.keys(params).sort()
    const data = url + sortedKeys.map((k) => k + params[k]).join('')
    const sig = crypto.createHmac('sha1', authToken).update(data).digest('base64')
    const fd = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) fd.set(k, v)
    return new Request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': sig,
      },
      body: fd.toString(),
    })
  }

  it('401s when TWILIO_AUTH_TOKEN is set and signature is missing', async () => {
    process.env.TWILIO_AUTH_TOKEN = 'auth-tok'
    process.env.TWILIO_STATUS_CALLBACK_URL = 'http://localhost/wh'
    const fd = new URLSearchParams({ MessageSid: 'SM-1', MessageStatus: 'delivered' })
    const req = new Request('http://localhost/wh', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: fd.toString(),
    }) as any
    const res = await twilioWebhook(req)
    expect(res.status).toBe(401)
  })

  it('401s on a bad signature', async () => {
    process.env.TWILIO_AUTH_TOKEN = 'auth-tok'
    process.env.TWILIO_STATUS_CALLBACK_URL = 'http://localhost/wh'
    const fd = new URLSearchParams({ MessageSid: 'SM-1', MessageStatus: 'delivered' })
    const req = new Request('http://localhost/wh', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'deadbeef',
      },
      body: fd.toString(),
    }) as any
    const res = await twilioWebhook(req)
    expect(res.status).toBe(401)
  })

  it('200s on a correctly-signed payload', async () => {
    process.env.TWILIO_AUTH_TOKEN = 'auth-tok'
    process.env.TWILIO_STATUS_CALLBACK_URL = 'http://localhost/wh'
    const req = signedTwilioReq(
      'http://localhost/wh',
      { MessageSid: 'SM-OK', MessageStatus: 'delivered' },
      'auth-tok',
    ) as any
    const res = await twilioWebhook(req)
    expect(res.status).toBe(200)
  })

  it('accepts unsigned requests when TWILIO_AUTH_TOKEN is unset (dev mode)', async () => {
    delete process.env.TWILIO_AUTH_TOKEN
    const fd = new URLSearchParams({ MessageSid: 'SM-D', MessageStatus: 'delivered' })
    const req = new Request('http://localhost/wh', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: fd.toString(),
    }) as any
    const res = await twilioWebhook(req)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/webhooks/resend — Svix signature verification', () => {
  const SAVED_ENV = { ...process.env }
  beforeAll(async () => { await startTestDb() })
  afterAll(async () => { await stopTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    process.env = { ...SAVED_ENV }
  })

  const SECRET_BYTES = crypto.randomBytes(32)
  const SECRET = `whsec_${SECRET_BYTES.toString('base64')}`

  function signedResendReq(body: unknown, opts: { tsOffsetSec?: number; tamperedSig?: boolean } = {}) {
    const raw = JSON.stringify(body)
    const id = 'msg_test_001'
    const ts = String(Math.floor(Date.now() / 1000) + (opts.tsOffsetSec ?? 0))
    const sig = crypto
      .createHmac('sha256', SECRET_BYTES)
      .update(`${id}.${ts}.${raw}`)
      .digest('base64')
    const headerSig = opts.tamperedSig ? `v1,${sig}aa` : `v1,${sig}`
    return new Request('http://localhost/wh', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': id,
        'svix-timestamp': ts,
        'svix-signature': headerSig,
      },
      body: raw,
    })
  }

  it('401s when the secret is set and no signature headers are present', async () => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET
    const req = new Request('http://localhost/wh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'email.delivered', data: { email_id: 'x' } }),
    }) as any
    const res = await resendWebhook(req)
    expect(res.status).toBe(401)
  })

  it('401s when the signature does not match', async () => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET
    const req = signedResendReq(
      { type: 'email.delivered', data: { email_id: 'x' } },
      { tamperedSig: true },
    ) as any
    const res = await resendWebhook(req)
    expect(res.status).toBe(401)
  })

  it('401s when the timestamp is outside the replay window', async () => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET
    const req = signedResendReq(
      { type: 'email.delivered', data: { email_id: 'x' } },
      { tsOffsetSec: -10 * 60 }, // 10 min in the past
    ) as any
    const res = await resendWebhook(req)
    expect(res.status).toBe(401)
  })

  it('200s on a correctly-signed payload', async () => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET
    const req = signedResendReq({
      type: 'email.delivered',
      data: { email_id: 'rs-signed' },
    }) as any
    const res = await resendWebhook(req)
    expect(res.status).toBe(200)
  })

  it('accepts unsigned requests when RESEND_WEBHOOK_SECRET is unset (dev mode)', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    const req = new Request('http://localhost/wh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'email.delivered', data: { email_id: 'rs-dev' } }),
    }) as any
    const res = await resendWebhook(req)
    expect(res.status).toBe(200)
  })
})
