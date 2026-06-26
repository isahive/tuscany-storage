import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeUnit } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import Promotion from '@/models/Promotion'
import { POST as calculateCharges } from '@/app/api/public/calculate-charges/route'

/** Mirrors the seed-promo.ts "Move-in Special" — an automatic, all-unit-types
 *  promo with no promo code. This is what the public flow must auto-apply. */
async function makeMoveInSpecial(over: Record<string, unknown> = {}) {
  return Promotion.create({
    name: 'Move-in Special',
    description: '1/2 off FIRST month. Prorated second month. After full deposit.',
    method: 'automatic',
    promoCode: '',
    discountType: 'percentage',
    discountValue: 50,
    unitTypes: [],
    allUnitTypes: true,
    startDate: new Date('2026-01-01'),
    endDate: null,
    beginsImmediately: true,
    beginsAfterCycles: 0,
    noExpiration: true,
    durationCycles: 1,
    status: 'active',
    appliedCount: 0,
    ...over,
  })
}

describe('POST /api/public/calculate-charges — automatic promo', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('auto-applies the active automatic promo without any promo code', async () => {
    const unit = await makeUnit({ price: 6500, status: 'available' })
    await makeMoveInSpecial()

    const res = await calculateCharges(
      makeRequest('POST', '', { unitId: unit._id.toString() }) as any,
    )
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.success).toBe(true)
    expect(json.data.appliedPromotion).not.toBeNull()
    expect(json.data.appliedPromotion.name).toBe('Move-in Special')
    expect(json.data.promoCodeError).toBeNull()
  })

  it('applies no promo when there is no active automatic promotion', async () => {
    const unit = await makeUnit({ price: 6500, status: 'available' })

    const res = await calculateCharges(
      makeRequest('POST', '', { unitId: unit._id.toString() }) as any,
    )
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.success).toBe(true)
    expect(json.data.appliedPromotion).toBeNull()
  })

  it('does not auto-apply a retired automatic promo', async () => {
    const unit = await makeUnit({ price: 6500, status: 'available' })
    await makeMoveInSpecial({ status: 'retired' })

    const res = await calculateCharges(
      makeRequest('POST', '', { unitId: unit._id.toString() }) as any,
    )
    const json = await readJson<any>(res)
    expect(json.data.appliedPromotion).toBeNull()
  })

  it('does not auto-apply an automatic promo scoped to a different unit type', async () => {
    const unit = await makeUnit({ price: 6500, status: 'available', type: 'standard' })
    await makeMoveInSpecial({ allUnitTypes: false, unitTypes: ['climate_controlled'] })

    const res = await calculateCharges(
      makeRequest('POST', '', { unitId: unit._id.toString() }) as any,
    )
    const json = await readJson<any>(res)
    expect(json.data.appliedPromotion).toBeNull()
  })
})
