import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'
import Payment from '@/models/Payment'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import { POST as refund } from '@/app/api/payments/refund/route'

async function pendingChargeAndPaidPayment(tenantId: string, leaseId: string, unitId: string, amount = 10000) {
  const charge = await Payment.create({
    tenantId, leaseId, unitId,
    type: 'rent', direction: 'charge', status: 'succeeded',
    amount, currency: 'usd',
    stripePaymentIntentId: `pi_${tenantId}_charge_${Math.random()}`,
  })
  const payment = await Payment.create({
    tenantId, leaseId, unitId,
    type: 'rent', direction: 'payment', status: 'succeeded',
    amount, currency: 'usd',
    stripePaymentIntentId: `pi_${tenantId}_pay_${Math.random()}`,
  })
  return { charge, payment }
}

describe('POST /api/payments/refund', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await refund(makeRequest('POST', '', { paymentId: 'x' }))
    expect(res.status).toBe(403)
  })

  it('400s on invalid payload', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await refund(makeRequest('POST', '', { paymentId: '', amount: -1 }))
    expect(res.status).toBe(400)
  })

  it('404s on unknown paymentId', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await refund(makeRequest('POST', '', { paymentId: '507f1f77bcf86cd799439099' }))
    expect(res.status).toBe(404)
  })

  it('refuses to refund a charge row (only payment rows can be refunded)', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    const { charge } = await pendingChargeAndPaidPayment(
      tenant._id.toString(), lease._id.toString(), unit._id.toString(),
    )
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await refund(makeRequest('POST', '', { paymentId: charge._id.toString() }))
    expect(res.status).toBe(422)
  })

  it('refuses to refund a payment that is not "succeeded"', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    const failed = await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      type: 'rent', direction: 'payment', status: 'failed', amount: 10000,
      currency: 'usd',
      stripePaymentIntentId: `pi_${tenant._id}_failed`,
    })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await refund(makeRequest('POST', '', { paymentId: failed._id.toString() }))
    expect(res.status).toBe(422)
  })

  it('refuses a refund amount that exceeds the original payment', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    const { payment } = await pendingChargeAndPaidPayment(
      tenant._id.toString(), lease._id.toString(), unit._id.toString(), 5000,
    )
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await refund(makeRequest('POST', '', { paymentId: payment._id.toString(), amount: 100 }))
    expect(res.status).toBe(422)
  })

  it('creates a refunded row on full refund (no Stripe configured)', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    const { payment } = await pendingChargeAndPaidPayment(
      tenant._id.toString(), lease._id.toString(), unit._id.toString(), 10000,
    )
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await refund(makeRequest('POST', '', {
      paymentId: payment._id.toString(),
      method: 'return_to_card',
      reason: 'tenant overpaid',
    }))
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.success).toBe(true)

    const refundRow = await Payment.findOne({
      tenantId: tenant._id,
      direction: 'payment',
      status: 'refunded',
    })
    expect(refundRow).not.toBeNull()
  })
})
