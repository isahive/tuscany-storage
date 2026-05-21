import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import Tenant from '@/models/Tenant'
import { POST as savePm } from '@/app/api/portal/save-payment-method/route'
import { POST as pay } from '@/app/api/portal/pay/route'
import { POST as reserve } from '@/app/api/portal/reserve/route'

describe('POST /api/portal/save-payment-method', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  it('401s without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await savePm(makeRequest('POST', '', { paymentMethodId: 'pm_x' }))
    expect(res.status).toBe(401)
  })

  it('400s when paymentMethodId is missing', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await savePm(makeRequest('POST', '', {}))
    expect(res.status).toBe(400)
  })

  it('returns 503 in dev mode without STRIPE_SECRET_KEY (no Stripe configured)', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await savePm(makeRequest('POST', '', { paymentMethodId: 'pm_dev_abc' }))
    expect(res.status).toBe(503)
    void Tenant
  })
})

describe('POST /api/portal/pay', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('401s without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await pay(makeRequest('POST', '', { amount: 1000 }))
    expect(res.status).toBe(401)
  })

  it('rejects amount=0 / negative', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await pay(makeRequest('POST', '', { amount: 0 }))
    expect(res.status).toBe(400)
  })

  it('rejects unknown type enum', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await pay(makeRequest('POST', '', { amount: 1000, type: 'invalid' }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/portal/reserve', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('401s without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await reserve(makeRequest('POST', '', { unitId: '507f1f77bcf86cd799439099' }))
    expect(res.status).toBe(401)
  })

  it('400s when unitId is missing', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await reserve(makeRequest('POST', '', {}))
    expect(res.status).toBe(400)
  })
})
