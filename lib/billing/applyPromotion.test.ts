import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { Types } from 'mongoose'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'
import Promotion from '@/models/Promotion'
import Payment from '@/models/Payment'
import { applyPromotionToCharge } from './applyPromotion'

async function makePromo(over: Record<string, unknown> = {}) {
  return Promotion.create({
    name: 'Test',
    method: 'manual',
    discountType: 'percentage',
    discountValue: 50,
    durationCycles: 2,
    noExpiration: true,
    allUnitTypes: true,
    unitTypes: [],
    startDate: new Date(),
    status: 'active',
    appliedCount: 0,
    ...over,
  })
}

describe('applyPromotionToCharge', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('no_promotion when appliedPromotionId is null/undefined', async () => {
    const out = await applyPromotionToCharge(10000, new Types.ObjectId(), null)
    expect(out).toEqual({ discountedAmount: 10000, discount: 0, reason: 'no_promotion' })
  })

  it('not_found when the promo doc is missing', async () => {
    const out = await applyPromotionToCharge(10000, new Types.ObjectId(), new Types.ObjectId())
    expect(out.reason).toBe('not_found')
    expect(out.discount).toBe(0)
  })

  it('inactive when promo.status is "retired"', async () => {
    const p = await makePromo({ status: 'retired' })
    const out = await applyPromotionToCharge(10000, new Types.ObjectId(), p._id)
    expect(out.reason).toBe('inactive')
    expect(out.discountedAmount).toBe(10000)
  })

  it('expired when endDate < now and noExpiration is false', async () => {
    const p = await makePromo({
      noExpiration: false,
      endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    })
    const out = await applyPromotionToCharge(10000, new Types.ObjectId(), p._id)
    expect(out.reason).toBe('expired')
  })

  it('applies a percentage discount', async () => {
    const p = await makePromo({ discountType: 'percentage', discountValue: 25 })
    const out = await applyPromotionToCharge(10000, new Types.ObjectId(), p._id)
    expect(out).toMatchObject({ discountedAmount: 7500, discount: 2500 })
  })

  it('applies a fixed discount capped at the base amount', async () => {
    const p = await makePromo({ discountType: 'fixed', discountValue: 20000 })
    const out = await applyPromotionToCharge(5000, new Types.ObjectId(), p._id)
    expect(out).toEqual({ discountedAmount: 0, discount: 5000, promotionId: p._id.toString() })
  })

  it('duration_exceeded when cycles used >= durationCycles', async () => {
    const { lease, tenant, unit } = await makeRentedTenant()
    const p = await makePromo({ durationCycles: 2, noExpiration: false })
    // Two succeeded rent payments → cycles used = 2
    for (let i = 0; i < 2; i++) {
      await Payment.create({
        tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
        type: 'rent', direction: 'payment', status: 'succeeded',
        amount: 10000, currency: 'usd',
        stripePaymentIntentId: `pi_${i}_${Date.now()}`,
      })
    }
    const out = await applyPromotionToCharge(10000, lease._id, p._id)
    expect(out.reason).toBe('duration_exceeded')
    expect(out.discount).toBe(0)
  })

  it('noExpiration promos always apply regardless of cycles', async () => {
    const { lease, tenant, unit } = await makeRentedTenant()
    const p = await makePromo({ noExpiration: true, durationCycles: 1, discountType: 'fixed', discountValue: 1000 })
    for (let i = 0; i < 5; i++) {
      await Payment.create({
        tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
        type: 'rent', direction: 'payment', status: 'succeeded',
        amount: 10000, currency: 'usd',
        stripePaymentIntentId: `pi-noexp-${i}`,
      })
    }
    const out = await applyPromotionToCharge(10000, lease._id, p._id)
    expect(out.discount).toBe(1000)
  })
})
