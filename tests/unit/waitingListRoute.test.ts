import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))
vi.mock('@/lib/sendNotification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sendNotification')>('@/lib/sendNotification')
  return { ...actual, sendTemplatedNotification: vi.fn(async () => undefined) }
})

import { getServerSession } from 'next-auth'
import WaitingList from '@/models/WaitingList'
import { GET as listWaiting, POST as joinWaiting } from '@/app/api/waiting-list/route'

const validEntry = {
  name: 'Ada Lovelace',
  email: 'ada@x.com',
  phone: '555-1212',
  preferredSize: '10x10',
}

describe('GET /api/waiting-list', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await listWaiting(makeRequest('GET', '/api/waiting-list') as any)
    expect(res.status).toBe(403)
  })

  it('returns paginated entries to admins', async () => {
    await WaitingList.create({ ...validEntry })
    await WaitingList.create({ ...validEntry, email: 'b@x.com' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await listWaiting(makeRequest('GET', '/api/waiting-list') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(2)
  })

  it('filters by status', async () => {
    await WaitingList.create({ ...validEntry, status: 'waiting' })
    await WaitingList.create({ ...validEntry, email: 'c@x.com', status: 'notified' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await listWaiting(makeRequest('GET', '/api/waiting-list?status=notified') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(1)
  })
})

describe('POST /api/waiting-list', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('rejects invalid payload', async () => {
    const res = await joinWaiting(makeRequest('POST', '/api/waiting-list', { name: '' }))
    expect(res.status).toBe(400)
  })

  it('creates a public waiting-list entry without auth', async () => {
    const res = await joinWaiting(makeRequest('POST', '/api/waiting-list', validEntry))
    expect([200, 201]).toContain(res.status)
    const stored = await WaitingList.findOne({ email: 'ada@x.com' })
    expect(stored).not.toBeNull()
  })

  it('rate limits more than 5 submissions per minute from the same IP', async () => {
    const ip = '7.7.7.7'
    for (let i = 0; i < 5; i++) {
      const req = makeRequest('POST', '/api/waiting-list', { ...validEntry, email: `b${i}@x.com` }, { headers: { 'x-forwarded-for': ip } as any })
      const res = await joinWaiting(req)
      expect([200, 201]).toContain(res.status)
    }
    const req = makeRequest('POST', '/api/waiting-list', { ...validEntry, email: 'over@x.com' }, { headers: { 'x-forwarded-for': ip } as any })
    const res = await joinWaiting(req)
    expect(res.status).toBe(429)
  })
})
