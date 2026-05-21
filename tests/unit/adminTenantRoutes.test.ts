import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant, makeTenant } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

const { customersCreateMock, setupIntentsCreateMock } = vi.hoisted(() => ({
  customersCreateMock: vi.fn(async () => ({ id: 'cus_new' })),
  setupIntentsCreateMock: vi.fn(async () => ({ id: 'seti_x', client_secret: 'seti_x_secret' })),
}))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { create: customersCreateMock },
    setupIntents: { create: setupIntentsCreateMock },
  },
}))

import { getServerSession } from 'next-auth'
import Payment from '@/models/Payment'
import Tenant from '@/models/Tenant'
import { GET as getLinked } from '@/app/api/admin/tenants/[id]/linked/route'
import { GET as getOutstanding } from '@/app/api/admin/tenants/[id]/outstanding/route'
import { POST as createSetupIntent } from '@/app/api/admin/tenants/[id]/setup-intent/route'
import { GET as findDuplicates } from '@/app/api/admin/tenants/duplicates/route'

describe('GET /api/admin/tenants/[id]/linked', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await getLinked(makeRequest('GET', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('404s on unknown tenant', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getLinked(makeRequest('GET', '') as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    expect(res.status).toBe(404)
  })

  it('returns linked: [] when none', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getLinked(makeRequest('GET', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    const json = await readJson<any>(res)
    expect(json.data.linked).toEqual([])
  })

  it('returns projected linked tenants when set', async () => {
    const a = await makeTenant({ firstName: 'A' })
    const b = await makeTenant({ firstName: 'B' })
    await Tenant.findByIdAndUpdate(a._id, { linkedTenantIds: [b._id] })

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getLinked(makeRequest('GET', '') as any, { params: Promise.resolve({ id: a._id.toString() }) })
    const json = await readJson<any>(res)
    expect(json.data.linked).toHaveLength(1)
    expect(json.data.linked[0].firstName).toBe('B')
  })
})

describe('GET /api/admin/tenants/[id]/outstanding', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t._id.toString()) as never)
    const res = await getOutstanding(makeRequest('GET', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('returns pending charge rows for the tenant', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      type: 'rent', direction: 'charge', status: 'pending',
      amount: 10000, currency: 'usd', stripePaymentIntentId: `pi_${tenant._id}_1`,
    })
    await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      type: 'late_fee', direction: 'charge', status: 'pending',
      amount: 2500, currency: 'usd', stripePaymentIntentId: `pi_${tenant._id}_2`,
    })

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getOutstanding(makeRequest('GET', '') as any, { params: Promise.resolve({ id: tenant._id.toString() }) })
    const json = await readJson<any>(res)
    expect(json.data.items).toHaveLength(2)
  })
})

describe('POST /api/admin/tenants/[id]/setup-intent', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    customersCreateMock.mockClear()
    setupIntentsCreateMock.mockClear()
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await createSetupIntent(makeRequest('POST', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('returns a mock client secret in dev mode (no Stripe key)', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await createSetupIntent(makeRequest('POST', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.devMode).toBe(true)
    expect(json.data.clientSecret).toMatch(/^seti_mock_secret_/)
  })

  it('lazy-creates a Stripe customer when one does not exist (with Stripe key)', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    const t = await makeTenant({ stripeCustomerId: undefined })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await createSetupIntent(makeRequest('POST', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(200)
    expect(customersCreateMock).toHaveBeenCalledTimes(1)
    expect(setupIntentsCreateMock).toHaveBeenCalled()
  })
})

describe('GET /api/admin/tenants/duplicates', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await findDuplicates(makeRequest('GET', '/api/admin/tenants/duplicates') as any)
    expect(res.status).toBe(403)
  })

  it('returns scan metadata + matching pairs in the response', async () => {
    await makeTenant({ firstName: 'A', phone: '555-1234' })
    await makeTenant({ firstName: 'B', phone: '555-1234' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await findDuplicates(makeRequest('GET', '/api/admin/tenants/duplicates') as any)
    const json = await readJson<any>(res)
    expect(json.success).toBe(true)
    expect(json.data.scanned).toBe(2)
    expect(Array.isArray(json.data.pairs)).toBe(true)
  })

  it('excludes archived and walk-in synthetic tenants', async () => {
    await makeTenant({ archived: true, phone: '555-1111' })
    await makeTenant({ isRetailWalkIn: true, phone: '555-1111' })
    await makeTenant({ phone: '555-1111' })

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await findDuplicates(makeRequest('GET', '/api/admin/tenants/duplicates') as any)
    expect(res.status).toBe(200)
  })
})
