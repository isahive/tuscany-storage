import { describe, it, expect } from 'vitest'
import {
  formatMoney,
  formatDate,
  calculateProratedAmount,
  generateGateCode,
  parsePaginationParams,
} from './utils'

describe('formatMoney', () => {
  it('formats cents into a US dollar string', () => {
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(100)).toBe('$1.00')
    expect(formatMoney(12345)).toBe('$123.45')
  })

  it('handles negative amounts (credits)', () => {
    expect(formatMoney(-5000)).toBe('-$50.00')
  })
})

describe('formatDate', () => {
  it('returns an em dash for null/undefined/invalid', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('not-a-date')).toBe('—')
  })

  it('formats a Date into "Mon D, YYYY"', () => {
    expect(formatDate(new Date('2026-05-21T00:00:00Z'))).toMatch(/May (20|21), 2026/)
  })

  it('accepts an ISO string', () => {
    expect(formatDate('2026-01-15')).toMatch(/Jan (14|15), 2026/)
  })
})

describe('calculateProratedAmount', () => {
  it('returns the full rate when the start date is the 1st', () => {
    // 31-day month, full coverage → rate * 31/31 = rate
    expect(calculateProratedAmount(10000, new Date(2026, 0, 1))).toBe(10000)
  })

  it('returns 1 day worth when starting on the last day', () => {
    // Jan has 31 days. Starting Jan 31 → 1 day → ceil(10000/31) = 323
    expect(calculateProratedAmount(10000, new Date(2026, 0, 31))).toBe(323)
  })

  it('rounds up — never under-bills', () => {
    // Mid-month case shouldn't drop fractional cents
    const out = calculateProratedAmount(10000, new Date(2026, 0, 15))
    expect(out).toBeGreaterThanOrEqual(Math.floor((10000 * 17) / 31))
  })

  it('handles February correctly (28 vs 29 days)', () => {
    // 2025-02-01 → 28 days
    expect(calculateProratedAmount(2800, new Date(2025, 1, 1))).toBe(2800)
    // 2024-02-01 → 29 days (leap year)
    expect(calculateProratedAmount(2900, new Date(2024, 1, 1))).toBe(2900)
  })
})

describe('generateGateCode', () => {
  it('returns a 4-digit string between 1000 and 9999', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateGateCode()
      expect(code).toMatch(/^\d{4}$/)
      const n = parseInt(code, 10)
      expect(n).toBeGreaterThanOrEqual(1000)
      expect(n).toBeLessThanOrEqual(9999)
    }
  })
})

describe('parsePaginationParams', () => {
  it('uses defaults when nothing is set', () => {
    const out = parsePaginationParams(new URLSearchParams())
    expect(out).toEqual({ page: 1, limit: 20, skip: 0 })
  })

  it('parses page + limit', () => {
    const sp = new URLSearchParams({ page: '3', limit: '50' })
    expect(parsePaginationParams(sp)).toEqual({ page: 3, limit: 50, skip: 100 })
  })

  it('clamps limit to maxLimit', () => {
    const sp = new URLSearchParams({ limit: '500' })
    expect(parsePaginationParams(sp, { maxLimit: 100 }).limit).toBe(100)
  })

  it('clamps page below 1 and limit below 1', () => {
    // limit=0 → falsy → falls through to default 20; page=0 → falsy → default 1
    const sp = new URLSearchParams({ page: '0', limit: '0' })
    expect(parsePaginationParams(sp)).toEqual({ page: 1, limit: 20, skip: 0 })
  })

  it('handles negative or junk values gracefully', () => {
    // junk limit ('abc') falls back to default 20; negative page clamps to 1
    const sp = new URLSearchParams({ page: '-5', limit: 'abc' })
    const out = parsePaginationParams(sp)
    expect(out.page).toBe(1)
    expect(out.limit).toBe(20)
  })
})
