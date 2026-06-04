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

  it('credit covering exactly the total settles ALL pending line items FIFO', async () => {
    const { tenant } = await makeRentedTenant()
    await Tenant.findByIdAndUpdate(tenant._id, { balance: 26000 })
    // 4 monthly rent invoices, oldest first
    const items = []
    for (let i = 0; i < 4; i++) {
      items.push(await Payment.create({
        tenantId: tenant._id,
        amount: 6500,
        type: 'rent',
        status: 'pending',
        direction: 'charge',
        balanceAfter: 6500 * (i + 1),
        createdAt: new Date(2026, i, 1),
      }))
    }
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addCredit(
      makeRequest('POST', '', { amount: 26000 }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.settledItemIds).toHaveLength(4)
    expect(body.data.residual).toBe(0)

    const stillPending = await Payment.find({ tenantId: tenant._id, status: 'pending' })
    expect(stillPending).toHaveLength(0)
    const credit = await Payment.findOne({ tenantId: tenant._id, type: 'credit' })
    expect(credit!.appliedToItemIds).toHaveLength(4)
    const after = await Tenant.findById(tenant._id)
    expect(after!.balance).toBe(0)
  })

  it('credit larger than total pending settles all items + leaves residual as credit on account', async () => {
    const { tenant } = await makeRentedTenant()
    await Tenant.findByIdAndUpdate(tenant._id, { balance: 13000 })
    for (let i = 0; i < 2; i++) {
      await Payment.create({
        tenantId: tenant._id,
        amount: 6500,
        type: 'rent',
        status: 'pending',
        direction: 'charge',
        balanceAfter: 6500 * (i + 1),
        createdAt: new Date(2026, i, 1),
      })
    }
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addCredit(
      makeRequest('POST', '', { amount: 20000 }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.settledItemIds).toHaveLength(2)
    expect(body.data.residual).toBe(7000)

    const after = await Tenant.findById(tenant._id)
    // 13000 (owed) - 20000 (credit) = -7000 (credit on account)
    expect(after!.balance).toBe(-7000)
  })

  it('credit smaller than oldest pending item settles nothing (no partial split)', async () => {
    const { tenant } = await makeRentedTenant()
    await Tenant.findByIdAndUpdate(tenant._id, { balance: 13000 })
    for (let i = 0; i < 2; i++) {
      await Payment.create({
        tenantId: tenant._id,
        amount: 6500,
        type: 'rent',
        status: 'pending',
        direction: 'charge',
        balanceAfter: 6500 * (i + 1),
        createdAt: new Date(2026, i, 1),
      })
    }
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addCredit(
      makeRequest('POST', '', { amount: 3000 }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.settledItemIds).toHaveLength(0)
    expect(body.data.residual).toBe(3000)

    const stillPending = await Payment.find({ tenantId: tenant._id, status: 'pending' })
    expect(stillPending).toHaveLength(2)
    const after = await Tenant.findById(tenant._id)
    expect(after!.balance).toBe(10000) // 13000 - 3000 credit
  })

  it('credit covering some but not all items settles the oldest in order', async () => {
    const { tenant } = await makeRentedTenant()
    await Tenant.findByIdAndUpdate(tenant._id, { balance: 26000 })
    const items = []
    for (let i = 0; i < 4; i++) {
      items.push(await Payment.create({
        tenantId: tenant._id,
        amount: 6500,
        type: 'rent',
        status: 'pending',
        direction: 'charge',
        balanceAfter: 6500 * (i + 1),
        createdAt: new Date(2026, i, 1),
      }))
    }
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addCredit(
      makeRequest('POST', '', { amount: 13000 }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.settledItemIds).toHaveLength(2)
    // The two oldest specifically
    expect(body.data.settledItemIds).toEqual([
      items[0]._id.toString(),
      items[1]._id.toString(),
    ])
    expect(body.data.residual).toBe(0)
    const stillPending = await Payment.find({ tenantId: tenant._id, status: 'pending' }).sort({ createdAt: 1 })
    expect(stillPending).toHaveLength(2)
    expect(stillPending[0]._id.toString()).toBe(items[2]._id.toString())
  })

  it('credit honors taxRate on line items when computing coverage', async () => {
    const { tenant } = await makeRentedTenant()
    await Tenant.findByIdAndUpdate(tenant._id, { balance: 6500 })
    // $65 rent + 10% tax = $71.50 effective total
    await Payment.create({
      tenantId: tenant._id,
      amount: 6500,
      taxRate: 10,
      type: 'rent',
      status: 'pending',
      direction: 'charge',
      balanceAfter: 6500,
    })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    // $65 credit is NOT enough to cover the $71.50 effective item
    const res = await addCredit(
      makeRequest('POST', '', { amount: 6500 }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.settledItemIds).toHaveLength(0)
    expect(body.data.residual).toBe(6500)
  })

  it('credit on a tenant with no pending items just adds credit on account', async () => {
    const { tenant } = await makeRentedTenant()
    await Tenant.findByIdAndUpdate(tenant._id, { balance: 0 })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addCredit(
      makeRequest('POST', '', { amount: 5000 }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.settledItemIds).toHaveLength(0)
    expect(body.data.residual).toBe(5000)
    const after = await Tenant.findById(tenant._id)
    expect(after!.balance).toBe(-5000)
  })

  it('credit flips delinquent tenant back to active when balance hits 0', async () => {
    const { tenant } = await makeRentedTenant()
    await Tenant.findByIdAndUpdate(tenant._id, { balance: 5000, status: 'delinquent' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addCredit(
      makeRequest('POST', '', { amount: 5000 }) as any,
      { params: Promise.resolve({ id: tenant._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const after = await Tenant.findById(tenant._id)
    expect(after!.balance).toBe(0)
    expect(after!.status).toBe('active')
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
