import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import crypto from 'crypto'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'
import AccessLog from '@/models/AccessLog'
import VisitorAccess from '@/models/VisitorAccess'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { POST as pdkWebhook } from '@/app/api/webhooks/pdk/route'

const SECRET = 'tuscany-pdk-shhh'

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac('sha1', secret).update(body).digest('hex')
}

function signedReq(body: unknown, opts: { secret?: string; sig?: string | null } = {}) {
  const raw = JSON.stringify(body)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.sig === undefined) {
    headers['x-pdk-signature'] = sign(raw, opts.secret ?? SECRET)
  } else if (opts.sig !== null) {
    headers['x-pdk-signature'] = opts.sig
  }
  return new Request('http://localhost/api/webhooks/pdk', {
    method: 'POST', headers, body: raw,
  }) as any
}

function unsignedReq(body: unknown) {
  return new Request('http://localhost/api/webhooks/pdk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

describe('POST /api/webhooks/pdk', () => {
  beforeAll(async () => { await startTestDb() })
  afterAll(async () => { await stopTestDb() })

  beforeEach(async () => {
    await clearTestDb()
    delete process.env.PDK_WEBHOOK_SECRET
  })

  describe('signature verification (HMAC SHA-1)', () => {
    it('accepts unsigned requests when PDK_WEBHOOK_SECRET is not set (dev mode)', async () => {
      const res = await pdkWebhook(unsignedReq({ type: 'unknown.event' }))
      expect(res.status).toBe(200)
    })

    it('401s when signature header is missing and secret is set', async () => {
      process.env.PDK_WEBHOOK_SECRET = SECRET
      const res = await pdkWebhook(unsignedReq({ type: 'unknown.event' }))
      expect(res.status).toBe(401)
    })

    it('401s when signature does not match', async () => {
      process.env.PDK_WEBHOOK_SECRET = SECRET
      const res = await pdkWebhook(signedReq(
        { type: 'unknown.event' },
        { sig: 'deadbeef' },
      ))
      expect(res.status).toBe(401)
    })

    it('401s when signature was made with a different secret', async () => {
      process.env.PDK_WEBHOOK_SECRET = SECRET
      const res = await pdkWebhook(signedReq(
        { type: 'unknown.event' },
        { secret: 'wrong-secret' },
      ))
      expect(res.status).toBe(401)
    })

    it('200s when HMAC SHA-1 of the body matches', async () => {
      process.env.PDK_WEBHOOK_SECRET = SECRET
      const res = await pdkWebhook(signedReq({ type: 'unknown.event' }))
      expect(res.status).toBe(200)
    })
  })

  describe('payload validation', () => {
    it('400s on invalid JSON (signature is checked first; needs correct hmac on raw body)', async () => {
      const raw = 'not json'
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        // No secret set so signature check passes.
      }
      const req = new Request('http://localhost/api/webhooks/pdk', {
        method: 'POST', headers, body: raw,
      }) as any
      const res = await pdkWebhook(req)
      expect(res.status).toBe(400)
    })

    it('400s when event.type is missing', async () => {
      const res = await pdkWebhook(unsignedReq({ data: {} }))
      expect(res.status).toBe(400)
    })
  })

  describe('device.request.allowed', () => {
    it('writes an entry AccessLog for the matching tenant', async () => {
      const t = await makeTenant({ pdkHolderId: 'pdk-h-1' })
      const res = await pdkWebhook(unsignedReq({
        type: 'device.request.allowed',
        data: { holderId: 'pdk-h-1', deviceId: 'd1' },
      }))
      expect(res.status).toBe(200)

      const logs = await AccessLog.find({ tenantId: t._id })
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('entry')
      expect(logs[0].source).toBe('keypad')
      expect(logs[0].gateId).toBe('entrance')
    })

    it('200s without writing a log when no tenant has that pdkHolderId', async () => {
      const res = await pdkWebhook(unsignedReq({
        type: 'device.request.allowed',
        data: { holderId: 'unmapped-holder' },
      }))
      expect(res.status).toBe(200)
      expect(await AccessLog.countDocuments()).toBe(0)
    })

    it('200s without writing when holderId is missing from payload', async () => {
      const res = await pdkWebhook(unsignedReq({ type: 'device.request.allowed', data: {} }))
      expect(res.status).toBe(200)
      expect(await AccessLog.countDocuments()).toBe(0)
    })
  })

  describe('device.request.denied', () => {
    it('writes a denied AccessLog for the matching tenant', async () => {
      const t = await makeTenant({ pdkHolderId: 'pdk-h-3' })
      await pdkWebhook(unsignedReq({
        type: 'device.request.denied',
        data: { holderId: 'pdk-h-3', reason: 'expired pin' },
      }))
      const logs = await AccessLog.find({ tenantId: t._id })
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('denied')
      expect(logs[0].notes).toBe('expired pin')
    })
  })

  describe('device.request.unknown', () => {
    it('200s without writing when the credential is not recognized (no holderId)', async () => {
      await pdkWebhook(unsignedReq({
        type: 'device.request.unknown',
        data: { deviceId: 'd1' },
      }))
      expect(await AccessLog.countDocuments()).toBe(0)
    })
  })

  describe('device alarms', () => {
    it.each(['device.alarm.forced', 'device.alarm.propped.on'])(
      '200s and logs to console without touching the DB on %s',
      async (eventType) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const res = await pdkWebhook(unsignedReq({
          type: eventType,
          data: { deviceId: 'd1' },
        }))
        expect(res.status).toBe(200)
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/device\.alarm/))
        warn.mockRestore()
      },
    )
  })

  describe('visitor pass attribution', () => {
    it('writes an entry AccessLog with visitorAccessId when holder maps to a visitor pass', async () => {
      const visitor = await VisitorAccess.create({
        name: 'Probe Visitor', purpose: 'HVAC',
        validFrom: new Date(Date.now() - 60_000),
        validUntil: new Date(Date.now() + 60 * 60_000),
        pin: '707070',
        status: 'active',
        pdkHolderId: 'pdk-h-vis-1',
        createdBy: 'admin',
      })
      const res = await pdkWebhook(unsignedReq({
        type: 'device.request.allowed',
        data: { holderId: 'pdk-h-vis-1', deviceId: 'd1' },
      }))
      expect(res.status).toBe(200)
      const logs = await AccessLog.find({ visitorAccessId: visitor._id })
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('entry')
      expect(logs[0].tenantId).toBeUndefined()
    })

    it('prefers tenant attribution when holderId could theoretically match both', async () => {
      // PDK guarantees unique holderIds, but defense-in-depth: if a stale
      // visitor record ever shared a holderId with a tenant, tenant wins.
      const tenant = await makeTenant({ pdkHolderId: 'pdk-shared' })
      await VisitorAccess.create({
        name: 'Stale', purpose: 'p',
        validFrom: new Date(Date.now() - 60_000),
        validUntil: new Date(Date.now() + 60 * 60_000),
        pin: '808080',
        status: 'active',
        pdkHolderId: 'pdk-shared',
        createdBy: 'admin',
      })
      await pdkWebhook(unsignedReq({
        type: 'device.request.allowed',
        data: { holderId: 'pdk-shared' },
      }))
      const logs = await AccessLog.find({})
      expect(logs).toHaveLength(1)
      expect(String(logs[0].tenantId)).toBe(String(tenant._id))
      expect(logs[0].visitorAccessId).toBeUndefined()
    })

    it('writes a denied log for visitor pass when keypad rejects them', async () => {
      const visitor = await VisitorAccess.create({
        name: 'Bad Visitor', purpose: 'p',
        validFrom: new Date(Date.now() - 60_000),
        validUntil: new Date(Date.now() + 60 * 60_000),
        pin: '909090',
        status: 'active',
        pdkHolderId: 'pdk-h-vis-2',
        createdBy: 'admin',
      })
      await pdkWebhook(unsignedReq({
        type: 'device.request.denied',
        data: { holderId: 'pdk-h-vis-2', reason: 'out of schedule' },
      }))
      const logs = await AccessLog.find({ visitorAccessId: visitor._id })
      expect(logs).toHaveLength(1)
      expect(logs[0].eventType).toBe('denied')
      expect(logs[0].notes).toBe('out of schedule')
    })
  })

  describe('unhandled events', () => {
    it.each([
      'device.alarm.forced.cleared',
      'device.alarm.propped.off',
      'device.input.relay.on',
      'device.input.relay.off',
      'totally.unknown',
    ])('200s without effect on %s', async (eventType) => {
      const res = await pdkWebhook(unsignedReq({ type: eventType, data: {} }))
      expect(res.status).toBe(200)
      expect(await AccessLog.countDocuments()).toBe(0)
    })
  })
})
