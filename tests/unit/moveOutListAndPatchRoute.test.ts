import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))
// Stub all outbound notifications — PATCH approve fires "Scheduled Move Out".
vi.mock('@/lib/sendNotification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sendNotification')>('@/lib/sendNotification')
  return { ...actual, sendTemplatedNotification: vi.fn(async () => undefined) }
})

import { getServerSession } from 'next-auth'
import MoveOutRequest from '@/models/MoveOutRequest'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import { GET as listMoveOut } from '@/app/api/move-out/route'
import { PATCH as patchMoveOut } from '@/app/api/move-out/[id]/route'

async function pendingFor(tenantId: string, leaseId: string, unitId: string, date: Date) {
  return MoveOutRequest.create({
    tenantId, leaseId, unitId,
    requestedMoveOutDate: date,
    status: 'pending',
    photoUrls: [],
    guidelines: '',
  })
}

describe('GET /api/move-out (admin list)', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admin callers', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t-1') as never)
    const req = makeRequest('GET', '/api/move-out')
    const res = await listMoveOut(req as any)
    expect(res.status).toBe(403)
  })

  it('returns every request when no filters are passed', async () => {
    const r1 = await makeRentedTenant()
    const r2 = await makeRentedTenant()
    await pendingFor(r1.tenant._id.toString(), r1.lease._id.toString(), r1.unit._id.toString(), new Date())
    await pendingFor(r2.tenant._id.toString(), r2.lease._id.toString(), r2.unit._id.toString(), new Date())

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const req = makeRequest('GET', '/api/move-out')
    const res = await listMoveOut(req as any)
    const json = await readJson<{ success: boolean; data: unknown[] }>(res)
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
  })

  it('filters by status', async () => {
    const r = await makeRentedTenant()
    const a = await pendingFor(r.tenant._id.toString(), r.lease._id.toString(), r.unit._id.toString(), new Date())
    a.status = 'approved'; await a.save()
    await pendingFor(r.tenant._id.toString(), r.lease._id.toString(), r.unit._id.toString(), new Date())

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const req = makeRequest('GET', '/api/move-out?status=approved')
    const res = await listMoveOut(req as any)
    const json = await readJson<{ data: unknown[] }>(res)
    expect(json.data).toHaveLength(1)
  })

  it('filters by tenantId', async () => {
    const r1 = await makeRentedTenant()
    const r2 = await makeRentedTenant()
    await pendingFor(r1.tenant._id.toString(), r1.lease._id.toString(), r1.unit._id.toString(), new Date())
    await pendingFor(r2.tenant._id.toString(), r2.lease._id.toString(), r2.unit._id.toString(), new Date())

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const req = makeRequest('GET', `/api/move-out?tenantId=${r2.tenant._id}`)
    const res = await listMoveOut(req as any)
    const json = await readJson<{ data: Array<{ tenantId: { _id?: string } | string }> }>(res)
    expect(json.data).toHaveLength(1)
  })
})

describe('PATCH /api/move-out/[id] (approve/deny)', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const r = await makeRentedTenant()
    const req = await pendingFor(r.tenant._id.toString(), r.lease._id.toString(), r.unit._id.toString(), new Date())
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const httpReq = makeRequest('PATCH', `/api/move-out/${req._id}`, { status: 'approved' })
    const res = await patchMoveOut(httpReq as any, { params: Promise.resolve({ id: req._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('approve cascades lease → pending_moveout + unit → reserved', async () => {
    const r = await makeRentedTenant()
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const moveOutReq = await pendingFor(r.tenant._id.toString(), r.lease._id.toString(), r.unit._id.toString(), future)

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const httpReq = makeRequest('PATCH', `/api/move-out/${moveOutReq._id}`, { status: 'approved' })
    const res = await patchMoveOut(httpReq as any, { params: Promise.resolve({ id: moveOutReq._id.toString() }) })
    expect(res.status).toBe(200)

    const updatedLease = await Lease.findById(r.lease._id)
    expect(updatedLease!.status).toBe('pending_moveout')
    expect(updatedLease!.moveOutDate?.toISOString()).toBe(future.toISOString())

    const updatedUnit = await Unit.findById(r.unit._id)
    expect(updatedUnit!.status).toBe('reserved')
  })

  it('deny on a pending_moveout lease reverts to active + occupied', async () => {
    const r = await makeRentedTenant()
    await Lease.findByIdAndUpdate(r.lease._id, { status: 'pending_moveout', moveOutDate: new Date() })
    await Unit.findByIdAndUpdate(r.unit._id, { status: 'reserved' })
    const moveOutReq = await pendingFor(r.tenant._id.toString(), r.lease._id.toString(), r.unit._id.toString(), new Date())

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const httpReq = makeRequest('PATCH', `/api/move-out/${moveOutReq._id}`, { status: 'denied', adminNotes: 'Cancelled' })
    const res = await patchMoveOut(httpReq as any, { params: Promise.resolve({ id: moveOutReq._id.toString() }) })
    expect(res.status).toBe(200)

    const updatedLease = await Lease.findById(r.lease._id)
    expect(updatedLease!.status).toBe('active')
    const updatedUnit = await Unit.findById(r.unit._id)
    expect(updatedUnit!.status).toBe('occupied')
  })

  it('refuses to mutate a request that was already actioned', async () => {
    const r = await makeRentedTenant()
    const moveOutReq = await pendingFor(r.tenant._id.toString(), r.lease._id.toString(), r.unit._id.toString(), new Date())
    moveOutReq.status = 'approved'; await moveOutReq.save()

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const httpReq = makeRequest('PATCH', `/api/move-out/${moveOutReq._id}`, { status: 'denied' })
    const res = await patchMoveOut(httpReq as any, { params: Promise.resolve({ id: moveOutReq._id.toString() }) })
    expect(res.status).toBe(409)
  })

  it('rejects invalid status values via zod', async () => {
    const r = await makeRentedTenant()
    const moveOutReq = await pendingFor(r.tenant._id.toString(), r.lease._id.toString(), r.unit._id.toString(), new Date())
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const httpReq = makeRequest('PATCH', `/api/move-out/${moveOutReq._id}`, { status: 'whatever' })
    const res = await patchMoveOut(httpReq as any, { params: Promise.resolve({ id: moveOutReq._id.toString() }) })
    expect(res.status).toBe(400)
  })
})
