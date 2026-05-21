import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant, makeTenant } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'
import Payment from '@/models/Payment'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import { GET as getBalance } from '@/app/api/tenants/[id]/balance/route'

describe('GET /api/tenants/[id]/balance', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('401s without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const t = await makeTenant()
    const res = await getBalance(makeRequest('GET', '') as any, { params: { id: t._id.toString() } })
    expect(res.status).toBe(401)
  })

  it('forbids tenants from reading another tenant\'s balance', async () => {
    const me = await makeTenant()
    const other = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(me._id.toString()) as never)
    const res = await getBalance(makeRequest('GET', '') as any, { params: { id: other._id.toString() } })
    expect(res.status).toBe(403)
  })

  it('computes a positive balance from outstanding charges', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    await Payment.create({
      tenantId: tenant._id,
      leaseId: lease._id,
      unitId: unit._id,
      type: 'rent',
      direction: 'charge',
      status: 'pending',
      amount: 10000,
      currency: 'usd',
      dueDate: new Date(),
      stripePaymentIntentId: `pi_${tenant._id}_a`,
    })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getBalance(makeRequest('GET', '') as any, { params: { id: tenant._id.toString() } })
    const json = await readJson<any>(res)
    expect(res.status).toBe(200)
    expect(json.data.balance).toBe(10000)
  })

  it('credits subtract — succeeded payments reduce balance', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      type: 'rent', direction: 'charge', status: 'pending', amount: 10000,
      currency: 'usd', dueDate: new Date(),
      stripePaymentIntentId: `pi_${tenant._id}_c`,
    })
    await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      type: 'rent', direction: 'payment', status: 'succeeded', amount: 3000,
      currency: 'usd',
      stripePaymentIntentId: `pi_${tenant._id}_p`,
    })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getBalance(makeRequest('GET', '') as any, { params: { id: tenant._id.toString() } })
    const json = await readJson<any>(res)
    expect(json.data.balance).toBe(7000)
  })
})
