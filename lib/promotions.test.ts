import { describe, it, expect } from 'vitest'
import {
  isPromotionAvailable,
  isPromotionExpired,
  isPromotionLocked,
  disallowedEditFields,
  unitTypeExclusivityConflict,
  normalizePromoCode,
  findPromoCodeMatch,
  findAutomaticPromo,
  validateDateWindow,
  type PromotionLike,
} from './promotions'

const basePromo: PromotionLike = {
  method: 'manual',
  status: 'active',
  startDate: new Date(2026, 0, 1),
  endDate: null,
  noExpiration: true,
  appliedCount: 0,
  unitTypes: [],
  allUnitTypes: true,
}

describe('isPromotionAvailable', () => {
  it('true for an active, in-window, no-expiration promo', () => {
    expect(isPromotionAvailable(basePromo, new Date(2026, 5, 1))).toBe(true)
  })
  it('false when status is retired', () => {
    expect(isPromotionAvailable({ ...basePromo, status: 'retired' })).toBe(false)
  })
  it('false before startDate', () => {
    expect(isPromotionAvailable(basePromo, new Date(2025, 11, 1))).toBe(false)
  })
  it('false after endDate when noExpiration=false', () => {
    expect(isPromotionAvailable(
      { ...basePromo, noExpiration: false, endDate: new Date(2026, 1, 1) },
      new Date(2026, 5, 1),
    )).toBe(false)
  })
  it('true when noExpiration=true even past an endDate value', () => {
    expect(isPromotionAvailable(
      { ...basePromo, noExpiration: true, endDate: new Date(2025, 0, 1) },
      new Date(2026, 5, 1),
    )).toBe(true)
  })
})

describe('isPromotionExpired', () => {
  it('false when noExpiration', () => {
    expect(isPromotionExpired({ ...basePromo, endDate: new Date(2020, 0, 1) })).toBe(false)
  })
  it('false when endDate is null', () => {
    expect(isPromotionExpired({ ...basePromo, noExpiration: false, endDate: null })).toBe(false)
  })
  it('true when endDate is past and noExpiration is false', () => {
    expect(isPromotionExpired(
      { ...basePromo, noExpiration: false, endDate: new Date(2025, 0, 1) },
      new Date(2026, 5, 1),
    )).toBe(true)
  })
})

describe('isPromotionLocked', () => {
  it('false when appliedCount is 0', () => {
    expect(isPromotionLocked({ appliedCount: 0 })).toBe(false)
  })
  it('true when appliedCount > 0', () => {
    expect(isPromotionLocked({ appliedCount: 1 })).toBe(true)
  })
})

describe('disallowedEditFields', () => {
  it('blocks only method when not yet applied', () => {
    expect(disallowedEditFields({ appliedCount: 0 }, { method: 'manual', name: 'X' })).toEqual(['method'])
  })
  it('allows all the always-editable fields after apply', () => {
    expect(disallowedEditFields(
      { appliedCount: 1 },
      { name: 'X', description: 'Y', endDate: new Date() },
    )).toEqual([])
  })
  it('blocks locked-after-apply fields once applied', () => {
    expect(disallowedEditFields(
      { appliedCount: 1 },
      { discountValue: 25, startDate: new Date(), name: 'X' },
    ).sort()).toEqual(['discountValue', 'startDate'])
  })
  it('blocks method even after apply', () => {
    expect(disallowedEditFields(
      { appliedCount: 1 },
      { method: 'automatic' },
    )).toEqual(['method'])
  })
})

describe('unitTypeExclusivityConflict', () => {
  const existingAutoStandard = {
    _id: 'p1',
    method: 'automatic' as const,
    unitTypes: ['standard'],
    allUnitTypes: false,
    status: 'active' as const,
  }
  const existingCodeAll = {
    _id: 'p2',
    method: 'promo_code' as const,
    unitTypes: [],
    allUnitTypes: true,
    status: 'active' as const,
  }

  it('no conflict for manual method', () => {
    expect(unitTypeExclusivityConflict({
      proposed: { method: 'manual', unitTypes: ['standard'], allUnitTypes: false },
      existing: [existingAutoStandard],
    })).toEqual([])
  })

  it('no conflict when comparing two of the same method', () => {
    expect(unitTypeExclusivityConflict({
      proposed: { method: 'automatic', unitTypes: ['standard'], allUnitTypes: false },
      existing: [existingAutoStandard],
    })).toEqual([])
  })

  it('conflict on overlapping unit types between promo_code and automatic', () => {
    expect(unitTypeExclusivityConflict({
      proposed: { method: 'promo_code', unitTypes: ['standard'], allUnitTypes: false },
      existing: [existingAutoStandard],
    })).toEqual(['standard'])
  })

  it('conflict when existing covers all unit types', () => {
    expect(unitTypeExclusivityConflict({
      proposed: { method: 'automatic', unitTypes: ['standard'], allUnitTypes: false },
      existing: [existingCodeAll],
    })).toEqual(['standard'])
  })

  it('excludes self when editing', () => {
    expect(unitTypeExclusivityConflict({
      proposed: { id: 'p1', method: 'automatic', unitTypes: ['standard'], allUnitTypes: false },
      existing: [existingAutoStandard],
    })).toEqual([])
  })

  it('ignores retired existing promos', () => {
    expect(unitTypeExclusivityConflict({
      proposed: { method: 'promo_code', unitTypes: ['standard'], allUnitTypes: false },
      existing: [{ ...existingAutoStandard, status: 'retired' }],
    })).toEqual([])
  })
})

describe('normalizePromoCode', () => {
  it('uppercases and trims', () => {
    expect(normalizePromoCode(' summer25 ')).toBe('SUMMER25')
  })
})

describe('findPromoCodeMatch', () => {
  const codePromo: PromotionLike = {
    ...basePromo,
    method: 'promo_code',
    promoCode: 'SUMMER25',
    allUnitTypes: false,
    unitTypes: ['standard'],
  }

  it('matches case-insensitively', () => {
    expect(findPromoCodeMatch('summer25', [codePromo], 'standard', new Date(2026, 5, 1))).toBe(codePromo)
  })

  it('returns null when code missing', () => {
    expect(findPromoCodeMatch('', [codePromo], 'standard')).toBeNull()
  })

  it('returns null when unit type does not match', () => {
    expect(findPromoCodeMatch('SUMMER25', [codePromo], 'climate_controlled', new Date(2026, 5, 1))).toBeNull()
  })

  it('matches when allUnitTypes', () => {
    expect(findPromoCodeMatch('SUMMER25',
      [{ ...codePromo, allUnitTypes: true, unitTypes: [] }],
      'anything',
      new Date(2026, 5, 1),
    )).toBeTruthy()
  })

  it('skips manual / automatic promotions', () => {
    expect(findPromoCodeMatch('SUMMER25',
      [{ ...codePromo, method: 'manual' }],
      'standard',
      new Date(2026, 5, 1),
    )).toBeNull()
  })
})

describe('findAutomaticPromo', () => {
  const autoPromo: PromotionLike = {
    ...basePromo,
    method: 'automatic',
    allUnitTypes: true,
    unitTypes: [],
  }

  it('returns the active automatic promo regardless of unit type when allUnitTypes', () => {
    expect(findAutomaticPromo([autoPromo], 'standard', new Date(2026, 5, 1))).toBe(autoPromo)
  })

  it('returns null when there is no automatic promo', () => {
    expect(findAutomaticPromo(
      [{ ...autoPromo, method: 'promo_code', promoCode: 'X' }],
      'standard',
      new Date(2026, 5, 1),
    )).toBeNull()
  })

  it('skips an automatic promo that is not yet active', () => {
    expect(findAutomaticPromo([autoPromo], 'standard', new Date(2025, 11, 1))).toBeNull()
  })

  it('skips an automatic promo that has expired', () => {
    expect(findAutomaticPromo(
      [{ ...autoPromo, noExpiration: false, endDate: new Date(2026, 1, 1) }],
      'standard',
      new Date(2026, 5, 1),
    )).toBeNull()
  })

  it('respects unit-type scoping when not allUnitTypes', () => {
    const scoped: PromotionLike = { ...autoPromo, allUnitTypes: false, unitTypes: ['climate_controlled'] }
    expect(findAutomaticPromo([scoped], 'standard', new Date(2026, 5, 1))).toBeNull()
    expect(findAutomaticPromo([scoped], 'climate_controlled', new Date(2026, 5, 1))).toBe(scoped)
  })

  it('matches any unit type when none is provided', () => {
    expect(findAutomaticPromo([autoPromo], undefined, new Date(2026, 5, 1))).toBe(autoPromo)
  })
})

describe('validateDateWindow', () => {
  it('ok when no endDate', () => {
    expect(validateDateWindow(new Date(2026, 0, 1), null)).toEqual({ ok: true })
  })
  it('rejects endDate same day as start', () => {
    expect(validateDateWindow(new Date(2026, 0, 1), new Date(2026, 0, 1)).ok).toBe(false)
  })
  it('accepts endDate exactly 1 day after start', () => {
    expect(validateDateWindow(new Date(2026, 0, 1), new Date(2026, 0, 2)).ok).toBe(true)
  })
})
