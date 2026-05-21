import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

const { sendTemplatedMock, applyPromotionMock } = vi.hoisted(() => ({
  sendTemplatedMock: vi.fn(async () => undefined),
  applyPromotionMock: vi.fn(async (rate: number) => ({ discountedAmount: rate, discount: 0 })),
}))
vi.mock('@/lib/sendNotification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sendNotification')>('@/lib/sendNotification')
  return { ...actual, sendTemplatedNotification: sendTemplatedMock }
})
vi.mock('@/lib/billing/applyPromotion', () => ({
  applyPromotionToCharge: applyPromotionMock,
}))

import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Payment from '@/models/Payment'
import { runAutopay } from '@/jobs/autopay'

describe('jobs/autopay — runAutopay', () => {
  beforeAll(async () => {
    await startTestDb()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 10, 0, 0, 0))
  })
  beforeEach(async () => {
    await clearTestDb()
    sendTemplatedMock.mockClear()
    applyPromotionMock.mockClear()
    delete process.env.STRIPE_SECRET_KEY // Force the "no Stripe" path
  })
  afterAll(async () => {
    vi.useRealTimers()
    await stopTestDb()
  })

  it('skips tenants without an active lease', async () => {
    const { tenant } = await makeRentedTenant({ tenantOpts: { autopayEnabled: true } })
    await Lease.deleteMany({ tenantId: tenant._id })

    await runAutopay()
    expect(await Payment.countDocuments({ tenantId: tenant._id })).toBe(0)
  })

  it('only processes autopayEnabled tenants', async () => {
    await makeRentedTenant({ tenantOpts: { autopayEnabled: false }, leaseOpts: { billingDay: 11 } })
    await runAutopay()
    expect(applyPromotionMock).not.toHaveBeenCalled()
  })

  it('skips when billing date is not within the next 2 days', async () => {
    const { tenant } = await makeRentedTenant({
      tenantOpts: { autopayEnabled: true },
      // billingDay 20 of the same month vs now=June 10 → 10 days out, way > 2
      leaseOpts: { billingDay: 20 },
    })
    await runAutopay()
    expect(await Payment.countDocuments({ tenantId: tenant._id })).toBe(0)
  })

  it('skips when a payment already exists for the billing period', async () => {
    const { tenant, lease, unit } = await makeRentedTenant({
      tenantOpts: { autopayEnabled: true },
      leaseOpts: { billingDay: 11 }, // 1 day out from June 10
    })
    const periodStart = new Date(2026, 5, 11)
    await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      stripePaymentIntentId: `pre_${tenant._id}`,
      amount: 10000, currency: 'usd', type: 'rent', status: 'pending',
      periodStart, periodEnd: new Date(2026, 6, 11),
    })

    await runAutopay()
    expect(applyPromotionMock).not.toHaveBeenCalled()
    expect(await Payment.countDocuments({ tenantId: tenant._id })).toBe(1)
  })

  it('skips moved_out tenants (status not "active")', async () => {
    const { tenant } = await makeRentedTenant({
      tenantOpts: { autopayEnabled: true, status: 'moved_out' },
      leaseOpts: { billingDay: 11 },
    })
    await runAutopay()
    expect(await Payment.countDocuments({ tenantId: tenant._id })).toBe(0)
  })

  it('runs applyPromotionToCharge for eligible tenants on the billing window', async () => {
    const { tenant } = await makeRentedTenant({
      tenantOpts: { autopayEnabled: true },
      leaseOpts: { billingDay: 11, monthlyRate: 12000 },
    })
    await runAutopay()
    expect(applyPromotionMock).toHaveBeenCalled()
    expect(applyPromotionMock.mock.calls[0][0]).toBe(12000)
    void tenant
  })
})
