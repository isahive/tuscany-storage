import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import crypto from 'crypto'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'

const pdkMocks = vi.hoisted(() => ({
  tryOpenDevice: vi.fn(async () => undefined),
}))
vi.mock('@/lib/gateAdapters/pdk', () => pdkMocks)
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { POST as smsWebhook } from '@/app/api/webhooks/twilio/sms/route'
import Settings from '@/models/Settings'

const AUTH_TOKEN = 'tuscany-twilio-shhh'
const WEBHOOK_URL = 'https://tuscany-storage.onrender.com/api/webhooks/twilio/sms'

const ORIG_ENV = { ...process.env }

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })
beforeEach(async () => {
  await clearTestDb()
  pdkMocks.tryOpenDevice.mockReset()
  pdkMocks.tryOpenDevice.mockResolvedValue(undefined)
  process.env = { ...ORIG_ENV }
})

function enablePdk() {
  process.env.PDK_SYNC_ENABLED = 'true'
  process.env.PDK_CLIENT_ID = 'x'
  process.env.PDK_CLIENT_SECRET = 'x'
  process.env.PDK_SYSTEM_ID = 'x'
}

function sign(url: string, params: Record<string, string>, token: string): string {
  const sortedKeys = Object.keys(params).sort()
  let data = url
  for (const k of sortedKeys) data += k + params[k]
  return crypto.createHmac('sha1', token).update(data).digest('base64')
}

function makeReq(params: Record<string, string>, opts: { sig?: string | null; url?: string } = {}) {
  const body = new URLSearchParams(params).toString()
  const url = opts.url ?? WEBHOOK_URL
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (opts.sig === undefined) {
    headers['x-twilio-signature'] = sign(url, params, AUTH_TOKEN)
  } else if (opts.sig !== null) {
    headers['x-twilio-signature'] = opts.sig
  }
  return new Request(url, { method: 'POST', headers, body }) as any
}

describe('POST /api/webhooks/twilio/sms — signature verification', () => {
  it('accepts unsigned requests when TWILIO_AUTH_TOKEN is unset (dev mode)', async () => {
    delete process.env.TWILIO_AUTH_TOKEN
    process.env.TWILIO_WEBHOOK_URL = WEBHOOK_URL
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551234567'],
      pdkEntryDeviceIds: ['d1'],
    })
    enablePdk()

    const req = makeReq({ From: '+15551234567', Body: 'open' }, { sig: null })
    const res = await smsWebhook(req)
    expect(res.status).toBe(200)
  })

  it('401s when signature header is missing and token is set', async () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN
    process.env.TWILIO_WEBHOOK_URL = WEBHOOK_URL
    const req = makeReq({ From: '+15551234567', Body: 'open' }, { sig: null })
    const res = await smsWebhook(req)
    expect(res.status).toBe(401)
  })

  it('401s when signature does not match', async () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN
    process.env.TWILIO_WEBHOOK_URL = WEBHOOK_URL
    const req = makeReq({ From: '+15551234567', Body: 'open' }, { sig: 'badsig' })
    const res = await smsWebhook(req)
    expect(res.status).toBe(401)
  })

  it('200s with a valid signature', async () => {
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN
    process.env.TWILIO_WEBHOOK_URL = WEBHOOK_URL
    enablePdk()
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551234567'],
      pdkEntryDeviceIds: ['d1'],
    })

    const req = makeReq({ From: '+15551234567', Body: 'open' })
    const res = await smsWebhook(req)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('Gate opening')
  })
})

describe('POST /api/webhooks/twilio/sms — TwiML responses', () => {
  beforeEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN
    process.env.TWILIO_WEBHOOK_URL = WEBHOOK_URL
    enablePdk()
  })

  it('returns "Gate opening" TwiML for authorized phone with devices configured', async () => {
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551234567'],
      pdkEntryDeviceIds: ['d1', 'd2'],
    })
    const req = makeReq({ From: '+15551234567', Body: 'open' }, { sig: null })
    const res = await smsWebhook(req)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('Gate opening')
    expect(pdkMocks.tryOpenDevice).toHaveBeenCalledTimes(2)
  })

  it('returns "not authorized" TwiML for unknown phone (no info leak)', async () => {
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551111111'],
      pdkEntryDeviceIds: ['d1'],
    })
    const req = makeReq({ From: '+15559999999', Body: 'open' }, { sig: null })
    const res = await smsWebhook(req)
    const text = await res.text()
    expect(text).toContain('not authorized')
    expect(pdkMocks.tryOpenDevice).not.toHaveBeenCalled()
  })

  it('returns "not authorized" TwiML when authorized but no devices configured (no info leak)', async () => {
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551234567'],
      pdkEntryDeviceIds: [],
    })
    const req = makeReq({ From: '+15551234567', Body: 'open' }, { sig: null })
    const res = await smsWebhook(req)
    const text = await res.text()
    // Same body as "not authorized" — admin debugs via logs, not SMS reply.
    expect(text).toContain('not authorized')
  })

  it('returns "not authorized" TwiML when authorized but PDK kill switch off', async () => {
    delete process.env.PDK_SYNC_ENABLED
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551234567'],
      pdkEntryDeviceIds: ['d1'],
    })
    const req = makeReq({ From: '+15551234567', Body: 'open' }, { sig: null })
    const res = await smsWebhook(req)
    const text = await res.text()
    expect(text).toContain('not authorized')
  })

  it('returns 400 TwiML when From is missing', async () => {
    const req = makeReq({ Body: 'open' }, { sig: null })
    const res = await smsWebhook(req)
    expect(res.status).toBe(400)
  })
})
