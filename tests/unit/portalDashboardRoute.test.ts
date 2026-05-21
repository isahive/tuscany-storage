import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant, makeTenant } from '@/tests/helpers/factories'
import { readJson } from '@/tests/helpers/request'
import { tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import { GET as portalDashboard } from '@/app/api/portal/dashboard/route'

describe('GET /api/portal/dashboard', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('401s when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await portalDashboard()
    expect(res.status).toBe(401)
  })

  it('404s when the tenant id resolves to nothing', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('507f1f77bcf86cd799439099') as never)
    const res = await portalDashboard()
    expect(res.status).toBe(404)
  })

  it('returns contact, balance, rentals and billingHistory shapes', async () => {
    const { tenant, unit, lease } = await makeRentedTenant({
      tenantOpts: { firstName: 'Ada', lastName: 'Lovelace' },
    })

    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await portalDashboard()
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.success).toBe(true)
    expect(json.data.contact.fullName).toBe('Ada Lovelace')
    expect(json.data.balance).toMatchObject({
      outstanding: expect.any(Number),
      credit: expect.any(Number),
      balance: expect.any(Number),
    })
    expect(json.data.rentals).toHaveLength(1)
    expect(json.data.rentals[0]).toMatchObject({
      leaseId: lease._id.toString(),
      unitNumber: unit.unitNumber,
      status: 'active',
    })
  })

  it('exposes moveOutDate on rentals once the lease is pending_moveout', async () => {
    const { tenant, lease } = await makeRentedTenant()
    const moveOutDate = new Date('2026-12-31')
    // Update via the model directly so the test stays close to prod path
    const Lease = (await import('@/models/Lease')).default
    await Lease.findByIdAndUpdate(lease._id, { status: 'pending_moveout', moveOutDate })

    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await portalDashboard()
    const json = await readJson<any>(res)
    expect(json.data.rentals[0].status).toBe('pending_moveout')
    expect(new Date(json.data.rentals[0].moveOutDate).toISOString()).toBe(moveOutDate.toISOString())
  })

  it('splits positive balance into outstanding, negative into credit', async () => {
    const t = await makeTenant({ balance: 12500 })
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t._id.toString()) as never)
    let res = await portalDashboard()
    let json = await readJson<any>(res)
    expect(json.data.balance.outstanding).toBe(12500)
    expect(json.data.balance.credit).toBe(0)

    const t2 = await makeTenant({ balance: -5000 })
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t2._id.toString()) as never)
    res = await portalDashboard()
    json = await readJson<any>(res)
    expect(json.data.balance.outstanding).toBe(0)
    expect(json.data.balance.credit).toBe(5000)
  })
})
