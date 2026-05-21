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

import { getServerSession } from 'next-auth'
import { GET as listLeases, POST as createLease } from '@/app/api/leases/route'

describe('GET /api/leases', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('401s without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await listLeases(makeRequest('GET', '/api/leases') as any)
    expect(res.status).toBe(401)
  })

  it('returns admin: all leases', async () => {
    await makeRentedTenant()
    await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await listLeases(makeRequest('GET', '/api/leases') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(2)
  })

  it('restricts tenants to their own leases', async () => {
    const r1 = await makeRentedTenant()
    await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(r1.tenant._id.toString()) as never)
    const res = await listLeases(makeRequest('GET', '/api/leases') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(1)
  })

  it('admin can filter by tenantId', async () => {
    const r1 = await makeRentedTenant()
    await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await listLeases(makeRequest('GET', `/api/leases?tenantId=${r1.tenant._id}`) as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(1)
  })

  it('filters by status', async () => {
    const r1 = await makeRentedTenant()
    await makeRentedTenant({ leaseOpts: { status: 'ended' } })

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const resActive = await listLeases(makeRequest('GET', '/api/leases?status=active') as any)
    expect((await readJson<any>(resActive)).data.total).toBe(1)

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const resEnded = await listLeases(makeRequest('GET', '/api/leases?status=ended') as any)
    expect((await readJson<any>(resEnded)).data.total).toBe(1)
    void r1
  })
})

describe('POST /api/leases', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await createLease(makeRequest('POST', '/api/leases', {}))
    expect(res.status).toBe(403)
  })

  it('rejects invalid payloads', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await createLease(makeRequest('POST', '/api/leases', {
      tenantId: '', unitId: '', startDate: 'not-a-date', monthlyRate: -1, billingDay: 30,
    }))
    expect(res.status).toBe(400)
  })
})
