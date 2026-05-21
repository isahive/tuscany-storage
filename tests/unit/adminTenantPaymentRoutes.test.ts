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
import Payment from '@/models/Payment'
import Tenant from '@/models/Tenant'
import { POST as applyPayment } from '@/app/api/admin/tenants/[id]/apply-payment/route'
import { POST as createCharge } from '@/app/api/admin/tenants/[id]/charges/route'
import { POST as addCredit } from '@/app/api/admin/tenants/[id]/credits/route'

describe('POST /api/admin/tenants/[id]/credits', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await addCredit(makeRequest('POST', '', { amount: 1000 }) as any, { params: Promise.resolve({ id: tenant._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('rejects non-positive amounts', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addCredit(makeRequest('POST', '', { amount: 0 }) as any, { params: Promise.resolve({ id: tenant._id.toString() }) })
    expect(res.status).toBe(400)
  })

  it('404s on unknown tenant', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addCredit(makeRequest('POST', '', { amount: 1000 }) as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    expect(res.status).toBe(404)
  })

  it('creates a succeeded credit payment row + reduces tenant.balance', async () => {
    const { tenant } = await makeRentedTenant()
    await Tenant.findByIdAndUpdate(tenant._id, { balance: 5000 })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addCredit(
      makeRequest('POST', '', { amount: 2000, description: 'goodwill' }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const credits = await Payment.find({ tenantId: tenant._id, type: 'credit' })
    expect(credits).toHaveLength(1)
    expect(credits[0].amount).toBe(2000)
    expect(credits[0].status).toBe('succeeded')
    const after = await Tenant.findById(tenant._id)
    expect(after!.balance).toBe(3000)
  })
})

describe('POST /api/admin/tenants/[id]/charges', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await createCharge(
      makeRequest('POST', '', { kind: 'fee', refId: 'fee-1' }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(403)
  })

  it('rejects invalid payloads', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await createCharge(
      makeRequest('POST', '', { kind: 'invalid' }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(400)
  })

  it('404s on unknown tenant', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await createCharge(
      makeRequest('POST', '', { kind: 'fee', refId: 'late' }) as any,
      { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) },
    )
    expect(res.status).toBe(404)
  })
})

describe('POST /api/admin/tenants/[id]/apply-payment', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await applyPayment(
      makeRequest('POST', '', { amount: 1000, method: 'cash' }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(403)
  })

  it('rejects invalid amount', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await applyPayment(
      makeRequest('POST', '', { amount: -1, method: 'cash' }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(400)
  })

  it('rejects unknown method enum values', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await applyPayment(
      makeRequest('POST', '', { amount: 1000, method: 'bitcoin' }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(400)
  })

  it('records a cash payment immediately without Stripe', async () => {
    const { tenant } = await makeRentedTenant()
    await Tenant.findByIdAndUpdate(tenant._id, { balance: 10000 })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await applyPayment(
      makeRequest('POST', '', { amount: 5000, method: 'cash' }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect([200, 201]).toContain(res.status)
    const after = await Tenant.findById(tenant._id)
    expect(after!.balance).toBeLessThan(10000)
  })
})
