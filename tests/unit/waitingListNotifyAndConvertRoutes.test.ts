import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { adminSession, tenantSession } from '@/tests/helpers/session'
import WaitingList from '@/models/WaitingList'
import Tenant from '@/models/Tenant'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))
import { getServerSession } from 'next-auth'

const dispatchMocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendSMS: vi.fn(),
}))
vi.mock('@/lib/email', () => ({ sendEmail: dispatchMocks.sendEmail }))
vi.mock('@/lib/twilio', () => ({ sendSMS: dispatchMocks.sendSMS, default: () => null }))

import { POST as notifyPost } from '@/app/api/admin/waiting-list/[id]/notify/route'
import { POST as convertPost } from '@/app/api/admin/waiting-list/[id]/convert/route'

function jsonReq(body: unknown): Request {
  return new Request('http://localhost/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

async function seedEntry(over: Record<string, unknown> = {}) {
  return WaitingList.create({
    name: 'Ada Lovelace',
    email: 'ada@x.com',
    phone: '555-0001',
    preferredSize: '10x10',
    status: 'waiting',
    ...over,
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

describe('POST /api/admin/waiting-list/[id]/notify', () => {
  it('403s for non-admin sessions', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t1'))
    const entry = await seedEntry()
    const res = await notifyPost(jsonReq({}) as any, { params: Promise.resolve({ id: String(entry._id) }) })
    expect(res.status).toBe(403)
  })

  it('404s when the entry does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const res = await notifyPost(
      jsonReq({}) as any,
      { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) },
    )
    expect(res.status).toBe(404)
  })

  it('dispatches email + SMS (when opted in), flips status to notified, returns dispatch detail', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    dispatchMocks.sendEmail.mockResolvedValueOnce('id')
    dispatchMocks.sendSMS.mockResolvedValueOnce('sid')

    const entry = await seedEntry({ smsOptIn: true })
    const res = await notifyPost(
      jsonReq({}) as any,
      { params: Promise.resolve({ id: String(entry._id) }) },
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.dispatch.email).toBe(true)
    expect(json.data.dispatch.sms).toBe(true)

    const after = await WaitingList.findById(entry._id)
    expect(after!.status).toBe('notified')
    expect(after!.notifiedAt).toBeInstanceOf(Date)
  })

  it('still flips status when both dispatch channels fail (loud failure surfaced via dispatch object)', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    dispatchMocks.sendEmail.mockRejectedValueOnce(new Error('Resend down'))
    dispatchMocks.sendSMS.mockRejectedValueOnce(new Error('Twilio down'))

    const entry = await seedEntry({ smsOptIn: true })
    const res = await notifyPost(
      jsonReq({}) as any,
      { params: Promise.resolve({ id: String(entry._id) }) },
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.dispatch.email).toBe(false)
    expect(json.data.dispatch.sms).toBe(false)
    expect(json.data.dispatch.emailError).toMatch(/Resend down/)
    expect(json.data.dispatch.smsError).toMatch(/Twilio down/)

    const after = await WaitingList.findById(entry._id)
    expect(after!.status).toBe('notified')
  })

  it('skips SMS when entry has smsOptIn = false', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    dispatchMocks.sendEmail.mockResolvedValueOnce('id')

    const entry = await seedEntry({ smsOptIn: false })
    await notifyPost(
      jsonReq({}) as any,
      { params: Promise.resolve({ id: String(entry._id) }) },
    )
    expect(dispatchMocks.sendSMS).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/waiting-list/[id]/convert', () => {
  it('403s for non-admin sessions', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t1'))
    const entry = await seedEntry()
    const res = await convertPost(
      jsonReq({}) as any,
      { params: Promise.resolve({ id: String(entry._id) }) },
    )
    expect(res.status).toBe(403)
  })

  it('404s when entry does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const res = await convertPost(
      jsonReq({}) as any,
      { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) },
    )
    expect(res.status).toBe(404)
  })

  it('creates a tenant from the entry data and flips status to converted', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const entry = await seedEntry({ name: 'Grace Hopper', email: 'GRACE@x.com', smsOptIn: true })

    const res = await convertPost(
      jsonReq({}) as any,
      { params: Promise.resolve({ id: String(entry._id) }) },
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.reused).toBe(false)

    const tenant = await Tenant.findById(json.data.tenantId)
    expect(tenant!.firstName).toBe('Grace')
    expect(tenant!.lastName).toBe('Hopper')
    expect(tenant!.email).toBe('grace@x.com') // lowercased
    expect(tenant!.smsOptIn).toBe(true)

    const after = await WaitingList.findById(entry._id)
    expect(after!.status).toBe('converted')
  })

  it('reuses an existing tenant with the same email instead of duplicating', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const existing = await Tenant.create({
      firstName: 'Original', lastName: 'Account',
      email: 'reuse@x.com', phone: '555-0002',
      password: 'hash', smsOptIn: false, autopayEnabled: false,
      status: 'active', role: 'tenant',
    })
    const entry = await seedEntry({ email: 'reuse@x.com' })

    const res = await convertPost(
      jsonReq({}) as any,
      { params: Promise.resolve({ id: String(entry._id) }) },
    )
    const json = await res.json()
    expect(json.data.reused).toBe(true)
    expect(String(json.data.tenantId)).toBe(String(existing._id))

    // No duplicate Tenant created
    expect(await Tenant.countDocuments({ email: 'reuse@x.com' })).toBe(1)
  })

  it('409s when entry is already converted (avoids double-click bug)', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const entry = await seedEntry({ status: 'converted' })

    const res = await convertPost(
      jsonReq({}) as any,
      { params: Promise.resolve({ id: String(entry._id) }) },
    )
    expect(res.status).toBe(409)
  })

  it('handles single-word names by using a hyphen as lastName', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const entry = await seedEntry({ name: 'Madonna', email: 'madonna@x.com' })

    const res = await convertPost(
      jsonReq({}) as any,
      { params: Promise.resolve({ id: String(entry._id) }) },
    )
    const json = await res.json()
    const tenant = await Tenant.findById(json.data.tenantId)
    expect(tenant!.firstName).toBe('Madonna')
    expect(tenant!.lastName).toBe('-') // Tenant model requires lastName
  })
})
