import { describe, it, expect } from 'vitest'
import { computeBillingDay } from './billingDay'

function s(
  anchor: 'first_of_month' | 'signup_day' | 'custom_day',
  customDay = 1,
) {
  return { billingCycleAnchor: anchor, billingCycleCustomDay: customDay }
}

describe('computeBillingDay', () => {
  describe('first_of_month', () => {
    it('returns 1 regardless of signup day', () => {
      expect(computeBillingDay(s('first_of_month'), new Date('2026-06-10T12:00:00Z'))).toBe(1)
      expect(computeBillingDay(s('first_of_month'), new Date('2026-06-15T00:00:00Z'))).toBe(1)
      expect(computeBillingDay(s('first_of_month'), new Date('2026-06-30T23:59:00Z'))).toBe(1)
    })
  })

  describe('custom_day', () => {
    it('returns the configured custom day', () => {
      expect(computeBillingDay(s('custom_day', 15), new Date('2026-06-10T12:00:00Z'))).toBe(15)
    })

    it('clamps to 1..28 even if admin somehow saves outside', () => {
      expect(computeBillingDay(s('custom_day', 0), new Date('2026-06-10T12:00:00Z'))).toBe(1)
      expect(computeBillingDay(s('custom_day', 31), new Date('2026-06-10T12:00:00Z'))).toBe(28)
    })
  })

  describe('signup_day', () => {
    it('returns the day-of-month of the signup date', () => {
      expect(computeBillingDay(s('signup_day'), new Date('2026-06-10T00:00:00Z'))).toBe(10)
      expect(computeBillingDay(s('signup_day'), new Date('2026-06-01T00:00:00Z'))).toBe(1)
    })

    it('caps at 28 so leases starting 29/30/31 still bill every month', () => {
      expect(computeBillingDay(s('signup_day'), new Date('2026-01-29T00:00:00Z'))).toBe(28)
      expect(computeBillingDay(s('signup_day'), new Date('2026-03-31T00:00:00Z'))).toBe(28)
    })
  })
})
