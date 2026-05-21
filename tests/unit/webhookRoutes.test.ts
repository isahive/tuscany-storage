import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
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
