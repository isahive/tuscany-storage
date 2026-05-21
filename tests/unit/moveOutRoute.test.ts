import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { tenantSession, adminSession } from '@/tests/helpers/session'

// Mock NextAuth before importing the route — the route reads
// getServerSession at module evaluation time only via dynamic call, but
// vitest.mock hoists so it's safe to declare here.
vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
// startTestDb already connected mongoose to a memory server — skip the
// production cached-connection path that reads MONGODB_URI at import time.
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))
// Block outbound email — sendAdminNotification is fire-and-forget so it
// can't break the response, but stubbing keeps test logs quiet.
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => null),
  sendAdminNotification: vi.fn(async () => undefined),
}))

import { getServerSession } from 'next-auth'
import MoveOutRequest from '@/models/MoveOutRequest'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import { POST as createMoveOut } from '@/app/api/move-out/route'

describe('POST /api/move-out', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('rejects unauthenticated callers', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const req = makeRequest('POST', '/api/move-out', { requestedMoveOutDate: new Date().toISOString() })
    const res = await createMoveOut(req)
    expect(res.status).toBe(401)
  })

  it('creates a pending request and flips the lease to pending_moveout', async () => {
    const { tenant, unit, lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)

    const req = makeRequest('POST', '/api/move-out', {
      leaseId: lease._id.toString(),
      requestedMoveOutDate: new Date('2026-12-31').toISOString(),
    })
    const res = await createMoveOut(req)
    expect(res.status).toBe(201)

    const json = await readJson<{ success: boolean; data: { _id: string } }>(res)
    expect(json.success).toBe(true)

    const stored = await MoveOutRequest.findById(json.data._id)
    expect(stored).not.toBeNull()
    expect(stored!.status).toBe('pending')

    const updatedLease = await Lease.findById(lease._id)
    expect(updatedLease!.status).toBe('pending_moveout')
    expect(updatedLease!.moveOutDate?.toISOString()).toBe(new Date('2026-12-31').toISOString())

    const updatedUnit = await Unit.findById(unit._id)
    expect(updatedUnit!.status).toBe('reserved')
  })

  it('refuses a duplicate pending request on the same lease', async () => {
    const { tenant, lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValue(tenantSession(tenant._id.toString()) as never)

    const reqA = makeRequest('POST', '/api/move-out', {
      leaseId: lease._id.toString(),
      requestedMoveOutDate: new Date('2026-12-31').toISOString(),
    })
    await createMoveOut(reqA)

    const reqB = makeRequest('POST', '/api/move-out', {
      leaseId: lease._id.toString(),
      requestedMoveOutDate: new Date('2027-01-15').toISOString(),
    })
    const resB = await createMoveOut(reqB)
    expect(resB.status).toBe(409)
  })

  it('lets an admin schedule on behalf of any tenant', async () => {
    const { tenant, lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)

    const req = makeRequest('POST', '/api/move-out', {
      tenantId: tenant._id.toString(),
      leaseId: lease._id.toString(),
      requestedMoveOutDate: new Date('2026-12-31').toISOString(),
    })
    const res = await createMoveOut(req)
    expect(res.status).toBe(201)

    const stored = await MoveOutRequest.findOne({ tenantId: tenant._id })
    expect(stored).not.toBeNull()
  })

  it('rejects an invalid date payload', async () => {
    const { tenant, lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)

    const req = makeRequest('POST', '/api/move-out', {
      leaseId: lease._id.toString(),
      requestedMoveOutDate: 'not-a-date',
    })
    const res = await createMoveOut(req)
    expect(res.status).toBe(400)
  })
})
