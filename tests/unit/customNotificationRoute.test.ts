/**
 * Tests for POST /api/notifications — the admin "send custom notification"
 * route. Previously this route silently no-op'd in production (created a
 * 'pending' Notification record but never dispatched). The hardened route
 * mirrors actual dispatch outcomes into Notification.status.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { adminSession, tenantSession } from '@/tests/helpers/session'
import { makeTenant } from '@/tests/helpers/factories'
import Notification from '@/models/Notification'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))
const dispatchMocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendSMS: vi.fn(),
}))
vi.mock('@/lib/email', () => ({ sendEmail: dispatchMocks.sendEmail }))
vi.mock('@/lib/twilio', () => ({ sendSMS: dispatchMocks.sendSMS, default: () => null }))

import { getServerSession } from 'next-auth'
import { POST as notificationsPost } from '@/app/api/notifications/route'

function jsonReq(body: unknown): Request {
  return new Request('http://localhost/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })

beforeEach(async () => {
  await clearTestDb()
  vi.mocked(getServerSession).mockReset()
  dispatchMocks.sendEmail.mockReset()
  dispatchMocks.sendSMS.mockReset()
})

describe('POST /api/notifications', () => {
  it('403s for non-admin', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t1'))
    const res = await notificationsPost(
      jsonReq({ tenantId: 't1', type: 'custom', channel: 'email', body: 'hi' }) as any,
    )
    expect(res.status).toBe(403)
  })

  it('404s when tenantId does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const res = await notificationsPost(
      jsonReq({ tenantId: '507f1f77bcf86cd799439099', type: 'custom', channel: 'email', body: 'hi' }) as any,
    )
    expect(res.status).toBe(404)
  })

  it('records status=sent + resendMessageId when email dispatch succeeds', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    dispatchMocks.sendEmail.mockResolvedValueOnce('rs-1')
    const t = await makeTenant({ email: 'a@a.com' })

    const res = await notificationsPost(
      jsonReq({ tenantId: String(t._id), type: 'custom', channel: 'email', subject: 'hi', body: 'hello' }) as any,
    )
    expect(res.status).toBe(201)

    const notes = await Notification.find({ tenantId: t._id })
    expect(notes).toHaveLength(1)
    expect(notes[0].status).toBe('sent')
    expect(notes[0].resendMessageId).toBe('rs-1')
    expect(notes[0].sentAt).toBeInstanceOf(Date)
  })

  it('records status=failed when dispatch throws in prod (silent-failure regression guard)', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    dispatchMocks.sendEmail.mockRejectedValueOnce(new Error('Email service not configured'))
    const t = await makeTenant({ email: 'a@a.com' })

    const res = await notificationsPost(
      jsonReq({ tenantId: String(t._id), type: 'custom', channel: 'email', body: 'hello' }) as any,
    )
    expect(res.status).toBe(201)

    const notes = await Notification.find({ tenantId: t._id })
    expect(notes).toHaveLength(1)
    expect(notes[0].status).toBe('failed')
    expect(notes[0].failureReason).toMatch(/Email service not configured/)
    expect(notes[0].sentAt).toBeUndefined()
  })

  it('records status=sent when at least one of (email, sms) succeeds', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    dispatchMocks.sendEmail.mockResolvedValueOnce('rs-x')
    dispatchMocks.sendSMS.mockRejectedValueOnce(new Error('Twilio down'))
    const t = await makeTenant({ email: 'a@a.com', phone: '555-0001' })

    const res = await notificationsPost(
      jsonReq({ tenantId: String(t._id), type: 'custom', channel: 'both', body: 'hi' }) as any,
    )
    expect(res.status).toBe(201)

    const notes = await Notification.find({ tenantId: t._id })
    expect(notes[0].status).toBe('sent')
    expect(notes[0].resendMessageId).toBe('rs-x')
    expect(notes[0].twilioMessageSid).toBeUndefined()
  })

  it('records status=failed with combined error when both channels throw', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    dispatchMocks.sendEmail.mockRejectedValueOnce(new Error('A'))
    dispatchMocks.sendSMS.mockRejectedValueOnce(new Error('B'))
    const t = await makeTenant({ email: 'a@a.com', phone: '555-0001' })

    const res = await notificationsPost(
      jsonReq({ tenantId: String(t._id), type: 'custom', channel: 'both', body: 'hi' }) as any,
    )
    expect(res.status).toBe(201)

    const notes = await Notification.find({ tenantId: t._id })
    expect(notes[0].status).toBe('failed')
    expect(notes[0].failureReason).toMatch(/A/)
    expect(notes[0].failureReason).toMatch(/B/)
  })

  it('400s on missing required fields', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const res = await notificationsPost(
      jsonReq({ tenantId: 'x', type: 'custom' }) as any,
    )
    expect(res.status).toBe(400)
  })
})
