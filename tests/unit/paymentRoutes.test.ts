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

const { sendTemplatedMock } = vi.hoisted(() => ({ sendTemplatedMock: vi.fn(async () => undefined) }))
vi.mock('@/lib/sendNotification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sendNotification')>('@/lib/sendNotification')
  return { ...actual, sendTemplatedNotification: sendTemplatedMock }
})

import { getServerSession } from 'next-auth'
import Payment from '@/models/Payment'
import { POST as adminCharge } from '@/app/api/payments/admin-charge/route'
import { POST as setupIntent } from '@/app/api/payments/setup-intent/route'
import { POST as confirmSetup } from '@/app/api/payments/confirm-setup/route'
import { GET as getPayment } from '@/app/api/payments/[id]/route'
import { POST as sendReceipt } from '@/app/api/payments/[id]/send-receipt/route'

describe('POST /api/payments/admin-charge', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await adminCharge(makeRequest('POST', '', { tenantId: 'x', leaseId: 'x', amount: 10, type: 'rent' }))
    expect(res.status).toBe(403)
  })

  it('rejects invalid payload via zod', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await adminCharge(makeRequest('POST', '', { tenantId: '', leaseId: '', amount: 0, type: 'rent' }))
    expect(res.status).toBe(400)
  })

  it('rejects unknown type enum', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await adminCharge(makeRequest('POST', '', {
      tenantId: '507f1f77bcf86cd799439011',
      leaseId: '507f1f77bcf86cd799439012',
      amount: 100,
      type: 'whatever',
    }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/payments/setup-intent', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  it('401s without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await setupIntent(makeRequest('POST', '/api/payments/setup-intent'))
    expect(res.status).toBe(401)
  })

  it('returns a mock secret in dev mode', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await setupIntent(makeRequest('POST', '/api/payments/setup-intent'))
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.clientSecret).toMatch(/^seti_mock_secret_/)
  })

  it('404s when tenant id is invalid', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('507f1f77bcf86cd799439099') as never)
    const res = await setupIntent(makeRequest('POST', '/api/payments/setup-intent'))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/payments/confirm-setup', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('401s without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await confirmSetup(makeRequest('POST', '', { paymentMethodId: 'pm_x' }))
    expect(res.status).toBe(401)
  })

  it('400s on missing paymentMethodId', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await confirmSetup(makeRequest('POST', '', {}))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/payments/[id]', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('401s without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await getPayment(makeRequest('GET', '') as any, { params: { id: '507f1f77bcf86cd799439011' } })
    expect(res.status).toBe(401)
  })

  it('400s on invalid id', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getPayment(makeRequest('GET', '') as any, { params: { id: 'not-an-objectid' } })
    expect(res.status).toBe(400)
  })

  it('returns the payment row by id', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    const p = await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      type: 'rent', direction: 'charge', status: 'succeeded',
      amount: 10000, currency: 'usd', stripePaymentIntentId: `pi_${tenant._id}_z`,
    })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getPayment(makeRequest('GET', '') as any, { params: { id: p._id.toString() } })
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.amount).toBe(10000)
  })
})

describe('POST /api/payments/[id]/send-receipt', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    sendTemplatedMock.mockClear()
  })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await sendReceipt(makeRequest('POST', '') as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) })
    expect(res.status).toBe(403)
  })

  it('404s on unknown payment', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await sendReceipt(makeRequest('POST', '') as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    expect(res.status).toBe(404)
  })

  it('dispatches the "Manually Sent Payment Receipt" template', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    const p = await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      type: 'rent', direction: 'payment', status: 'succeeded',
      amount: 10000, currency: 'usd', stripePaymentIntentId: `pi_${tenant._id}_recpt`,
    })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await sendReceipt(makeRequest('POST', '') as any, { params: Promise.resolve({ id: p._id.toString() }) })
    expect(res.status).toBe(200)
    expect(sendTemplatedMock).toHaveBeenCalled()
  })
})
