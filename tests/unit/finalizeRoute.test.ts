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
// Gate access revocation reaches out to the gate controller in production —
// stub it so tests stay pure.
vi.mock('@/lib/gateAccess', () => ({
  revokeGateAccess: vi.fn(async () => undefined),
}))

import { getServerSession } from 'next-auth'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Tenant from '@/models/Tenant'
import MoveOutRequest from '@/models/MoveOutRequest'
import { POST as finalize } from '@/app/api/move-out/[id]/finalize/route'

async function buildPendingRequest() {
  const { tenant, unit, lease } = await makeRentedTenant()
  await Lease.findByIdAndUpdate(lease._id, { status: 'pending_moveout', moveOutDate: new Date() })
  await Unit.findByIdAndUpdate(unit._id, { status: 'reserved' })
  const req = await MoveOutRequest.create({
    tenantId: tenant._id,
    leaseId: lease._id,
    unitId: unit._id,
    requestedMoveOutDate: new Date(),
    status: 'pending',
    photoUrls: [],
    guidelines: '',
  })
  return { tenant, unit, lease, request: req }
}

describe('POST /api/move-out/[id]/finalize', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('blocks tenants', async () => {
    const { tenant, request } = await buildPendingRequest()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const req = makeRequest('POST', `/api/move-out/${request._id}/finalize`, {})
    const res = await finalize(req, { params: Promise.resolve({ id: request._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('ends lease, frees unit, marks tenant moved_out', async () => {
    const { tenant, unit, lease, request } = await buildPendingRequest()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)

    const req = makeRequest('POST', `/api/move-out/${request._id}/finalize`, {
      unitStatusAfter: 'available',
      archiveCustomer: false,
    })
    const res = await finalize(req, { params: Promise.resolve({ id: request._id.toString() }) })
    expect(res.status).toBe(200)
    const json = await readJson<{ data: { unitNumber: string } }>(res)
    expect(json.data.unitNumber).toBe(unit.unitNumber)

    expect((await Lease.findById(lease._id))!.status).toBe('ended')
    expect((await Unit.findById(unit._id))!.status).toBe('available')
    const t = await Tenant.findById(tenant._id)
    expect(t!.status).toBe('moved_out')
    expect(t!.archived).toBeFalsy()
  })

  it('respects archiveCustomer + unitStatusAfter overrides', async () => {
    const { tenant, unit, request } = await buildPendingRequest()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)

    const req = makeRequest('POST', `/api/move-out/${request._id}/finalize`, {
      unitStatusAfter: 'maintenance',
      archiveCustomer: true,
    })
    const res = await finalize(req, { params: Promise.resolve({ id: request._id.toString() }) })
    expect(res.status).toBe(200)

    expect((await Unit.findById(unit._id))!.status).toBe('maintenance')
    expect((await Tenant.findById(tenant._id))!.archived).toBe(true)
  })

  it('refuses to finalize a denied request', async () => {
    const { request } = await buildPendingRequest()
    request.status = 'denied'
    await request.save()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)

    const req = makeRequest('POST', `/api/move-out/${request._id}/finalize`, {})
    const res = await finalize(req, { params: Promise.resolve({ id: request._id.toString() }) })
    expect(res.status).toBe(409)
  })
})
