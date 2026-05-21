import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import WaitingList from '@/models/WaitingList'
import { PATCH as patchWaiting, DELETE as deleteWaiting } from '@/app/api/waiting-list/[id]/route'

const baseEntry = {
  name: 'Ada Lovelace',
  email: 'ada@x.com',
  phone: '555-1212',
  preferredSize: '10x10',
}

describe('PATCH /api/waiting-list/[id]', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const w = await WaitingList.create(baseEntry)
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await patchWaiting(makeRequest('PATCH', '', { status: 'notified' }) as any, { params: Promise.resolve({ id: w._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('rejects invalid status enum', async () => {
    const w = await WaitingList.create(baseEntry)
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await patchWaiting(makeRequest('PATCH', '', { status: 'whatever' }) as any, { params: Promise.resolve({ id: w._id.toString() }) })
    expect(res.status).toBe(400)
  })

  it('updates the status to notified', async () => {
    const w = await WaitingList.create(baseEntry)
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await patchWaiting(makeRequest('PATCH', '', { status: 'notified' }) as any, { params: Promise.resolve({ id: w._id.toString() }) })
    expect(res.status).toBe(200)
    const after = await WaitingList.findById(w._id)
    expect(after!.status).toBe('notified')
  })

  it('404s on unknown id', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await patchWaiting(makeRequest('PATCH', '', { status: 'notified' }) as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/waiting-list/[id]', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const w = await WaitingList.create(baseEntry)
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await deleteWaiting(makeRequest('DELETE', '') as any, { params: Promise.resolve({ id: w._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('deletes an entry', async () => {
    const w = await WaitingList.create(baseEntry)
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await deleteWaiting(makeRequest('DELETE', '') as any, { params: Promise.resolve({ id: w._id.toString() }) })
    expect(res.status).toBe(200)
    expect(await WaitingList.findById(w._id)).toBeNull()
  })
})
