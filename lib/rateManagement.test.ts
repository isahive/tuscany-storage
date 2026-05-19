import { describe, it, expect } from 'vitest'
import {
  roundToNearestDollar,
  applyRounding,
  computeNewRate,
  calcOccupancyByType,
  monthsBetween,
  suggestUnitTypePriceChanges,
  suggestRentalPriceChanges,
  isReminderDay,
  type UnitTypePriceRule,
  type RentalPriceRule,
  type LeaseFixture,
} from './rateManagement'

describe('roundToNearestDollar', () => {
  it('rounds up at the midpoint', () => {
    expect(roundToNearestDollar(12550)).toBe(12600) // $125.50 → $126
  })
  it('rounds down below the midpoint', () => {
    expect(roundToNearestDollar(12549)).toBe(12500) // $125.49 → $125
  })
  it('keeps whole dollars intact', () => {
    expect(roundToNearestDollar(12500)).toBe(12500)
  })
})

describe('applyRounding', () => {
  it('rounds to dollar when rule says so', () => {
    expect(applyRounding(12340, 'nearest_dollar')).toBe(12300)
  })
  it('returns the integer cents when rule is none', () => {
    expect(applyRounding(12345.7, 'none')).toBe(12346)
  })
})

describe('computeNewRate', () => {
  it('applies a flat amount increase', () => {
    expect(computeNewRate(10000, { increaseAmount: 1500 })).toBe(11500)
  })
  it('applies a percent increase', () => {
    expect(computeNewRate(10000, { increasePercent: 5 })).toBe(10500)
  })
  it('prefers percent when both supplied', () => {
    expect(computeNewRate(10000, { increasePercent: 10, increaseAmount: 500 })).toBe(11000)
  })
  it('returns base when nothing supplied', () => {
    expect(computeNewRate(10000, {})).toBe(10000)
  })
})

describe('calcOccupancyByType', () => {
  it('groups + computes pct per type', () => {
    const occ = calcOccupancyByType([
      { type: 'standard', status: 'occupied' },
      { type: 'standard', status: 'occupied' },
      { type: 'standard', status: 'vacant' },
      { type: 'standard', status: 'reserved' },
      { type: 'climate', status: 'occupied' },
      { type: 'climate', status: 'occupied' },
    ])
    expect(occ.standard.total).toBe(4)
    expect(occ.standard.occupied).toBe(2)
    expect(occ.standard.rate).toBe(50)
    expect(occ.climate.rate).toBe(100)
  })
  it('handles empty input', () => {
    expect(calcOccupancyByType([])).toEqual({})
  })
})

describe('monthsBetween', () => {
  it('counts full month deltas', () => {
    expect(monthsBetween(new Date('2024-01-15'), new Date('2025-01-15'))).toBe(12)
  })
  it('crosses year boundaries', () => {
    expect(monthsBetween(new Date('2024-11-01'), new Date('2025-02-01'))).toBe(3)
  })
  it('returns negatives if reversed', () => {
    expect(monthsBetween(new Date('2025-01-01'), new Date('2024-12-01'))).toBe(-1)
  })
})

describe('suggestUnitTypePriceChanges', () => {
  const baseRule: UnitTypePriceRule = {
    id: 'r1',
    unitType: 'standard',
    increasePercent: 5,
    minOccupancyPct: 90,
    roundingRule: 'nearest_dollar',
  }

  it('emits a suggestion when occupancy meets threshold', () => {
    const out = suggestUnitTypePriceChanges({
      rules: [baseRule],
      occupancy: { standard: { total: 10, occupied: 9, rate: 90 } },
      currentStreetRateByType: { standard: 10000 }, // $100
    })
    expect(out).toHaveLength(1)
    expect(out[0].suggestedStreetRate).toBe(10500) // $100 + 5% → $105
    expect(out[0].increaseAmount).toBe(500)
  })

  it('skips when occupancy is below threshold', () => {
    const out = suggestUnitTypePriceChanges({
      rules: [baseRule],
      occupancy: { standard: { total: 10, occupied: 5, rate: 50 } },
      currentStreetRateByType: { standard: 10000 },
    })
    expect(out).toEqual([])
  })

  it('skips a rule whose unit type has no occupancy or no street rate', () => {
    const out = suggestUnitTypePriceChanges({
      rules: [baseRule],
      occupancy: {},
      currentStreetRateByType: {},
    })
    expect(out).toEqual([])
  })

  it('applies flat amount with rounding', () => {
    const out = suggestUnitTypePriceChanges({
      rules: [{ ...baseRule, increasePercent: undefined, increaseAmount: 575 }],
      occupancy: { standard: { total: 10, occupied: 10, rate: 100 } },
      currentStreetRateByType: { standard: 10000 },
    })
    expect(out[0].suggestedStreetRate).toBe(10600) // $105.75 → $106
  })
})

describe('suggestRentalPriceChanges', () => {
  const rule: RentalPriceRule = {
    id: 'r1',
    unitType: 'standard',
    increasePercent: 5,
    minMonthsSinceLastChange: 12,
  }
  const now = new Date('2026-06-01')
  const globals = {
    advanceNoticeDays: 30,
    allowExceedingStreetRate: false,
    roundToNearestDollar: true,
  }
  const baseLease: LeaseFixture = {
    _id: 'l1',
    unitId: 'u1',
    tenantId: 't1',
    monthlyRate: 10000,
    startDate: new Date('2024-01-01'),
    status: 'active',
  }

  it('proposes when months threshold met', () => {
    const out = suggestRentalPriceChanges([baseLease], {
      rules: [rule],
      globals,
      unitTypeByUnitId: { u1: 'standard' },
      now,
    })
    expect(out).toHaveLength(1)
    expect(out[0].suggestedRate).toBe(10500)
    expect(out[0].monthsSinceLastChange).toBe(29)
  })

  it('skips exempt leases', () => {
    const out = suggestRentalPriceChanges(
      [{ ...baseLease, exemptFromRateManagement: true }],
      { rules: [rule], globals, unitTypeByUnitId: { u1: 'standard' }, now },
    )
    expect(out).toEqual([])
  })

  it('skips when months-since-last-change is below threshold', () => {
    const recent = { ...baseLease, lastRateChangeDate: new Date('2025-12-01') }
    const out = suggestRentalPriceChanges([recent], {
      rules: [rule],
      globals,
      unitTypeByUnitId: { u1: 'standard' },
      now,
    })
    expect(out).toEqual([])
  })

  it('skips non-active leases', () => {
    const out = suggestRentalPriceChanges(
      [{ ...baseLease, status: 'ended' as const }],
      { rules: [rule], globals, unitTypeByUnitId: { u1: 'standard' }, now },
    )
    expect(out).toEqual([])
  })

  it('caps at street rate when allowExceedingStreetRate=false', () => {
    const out = suggestRentalPriceChanges([baseLease], {
      rules: [rule],
      globals,
      unitTypeByUnitId: { u1: 'standard' },
      streetRateByUnitType: { standard: 10300 }, // $103 street
      now,
    })
    expect(out[0].suggestedRate).toBe(10300) // capped (not 10500)
  })

  it('allows exceeding street rate when flag is true', () => {
    const out = suggestRentalPriceChanges([baseLease], {
      rules: [rule],
      globals: { ...globals, allowExceedingStreetRate: true },
      unitTypeByUnitId: { u1: 'standard' },
      streetRateByUnitType: { standard: 10300 },
      now,
    })
    expect(out[0].suggestedRate).toBe(10500)
  })

  it('skips when computed rate would be a no-op', () => {
    // 0% increase on a rate that's already at the street cap → no-op
    const flat: RentalPriceRule = { ...rule, increasePercent: 0 }
    const out = suggestRentalPriceChanges([baseLease], {
      rules: [flat],
      globals,
      unitTypeByUnitId: { u1: 'standard' },
      now,
    })
    expect(out).toEqual([])
  })

  it('uses startDate when lastRateChangeDate is missing', () => {
    const out = suggestRentalPriceChanges([baseLease], {
      rules: [rule],
      globals,
      unitTypeByUnitId: { u1: 'standard' },
      now,
    })
    expect(out[0].monthsSinceLastChange).toBe(29) // since 2024-01 to 2026-06
  })

  it('computes notification + change dates from advanceNoticeDays', () => {
    const out = suggestRentalPriceChanges([baseLease], {
      rules: [rule],
      globals: { ...globals, advanceNoticeDays: 14 },
      unitTypeByUnitId: { u1: 'standard' },
      now,
    })
    expect(out[0].changeDate.getTime() - out[0].notificationDate.getTime())
      .toBe(14 * 24 * 60 * 60 * 1000)
  })

  it('skips leases whose unit type has no rule', () => {
    const out = suggestRentalPriceChanges(
      [{ ...baseLease, unitId: 'u-other' }],
      { rules: [rule], globals, unitTypeByUnitId: { 'u-other': 'climate' }, now },
    )
    expect(out).toEqual([])
  })
})

describe('isReminderDay', () => {
  // Build via numeric ctor so .getDate() returns the local day (ISO strings
  // are parsed as UTC and shift across timezones).
  it('returns true when day matches', () => {
    expect(isReminderDay(new Date(2026, 5, 15), 15)).toBe(true)
  })
  it('clamps reminderDay to last day of short months', () => {
    // Feb has 28 days; reminderDay=30 should fire on Feb 28.
    expect(isReminderDay(new Date(2026, 1, 28), 30)).toBe(true)
  })
  it('returns false on non-matching days', () => {
    expect(isReminderDay(new Date(2026, 5, 10), 15)).toBe(false)
  })
})
