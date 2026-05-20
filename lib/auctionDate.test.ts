import { describe, it, expect } from 'vitest'
import { computeAuctionDate } from './auctionDate'

const lockedOut = new Date(2026, 11, 1) // Dec 1, 2026

describe('computeAuctionDate', () => {
  it('returns null when nothing configured', () => {
    expect(computeAuctionDate(lockedOut, {})).toBeNull()
  })

  it('returns lockedOut + offset days', () => {
    const r = computeAuctionDate(lockedOut, { auctionDaysAfterLockout: 30 })
    expect(r?.getFullYear()).toBe(2026)
    expect(r?.getMonth()).toBe(11) // Dec 31, 2026 — same month
    expect(r?.getDate()).toBe(31)
  })

  it('crosses months and years cleanly', () => {
    const r = computeAuctionDate(new Date(2026, 11, 15), { auctionDaysAfterLockout: 30 })
    expect(r?.getFullYear()).toBe(2027)
    expect(r?.getMonth()).toBe(0) // Jan
    expect(r?.getDate()).toBe(14)
  })

  it('fixed date wins when in the future', () => {
    const fixed = new Date(2027, 5, 1)
    const r = computeAuctionDate(lockedOut, { auctionDaysAfterLockout: 30, auctionFixedDate: fixed })
    expect(r?.getTime()).toBe(fixed.getTime())
  })

  it('falls back to offset when fixed date is stale (before lockout)', () => {
    const fixed = new Date(2026, 0, 1)
    const r = computeAuctionDate(lockedOut, { auctionDaysAfterLockout: 30, auctionFixedDate: fixed })
    expect(r?.getDate()).toBe(31)
  })

  it('falls back to offset when fixed date is unparseable', () => {
    const r = computeAuctionDate(lockedOut, { auctionDaysAfterLockout: 30, auctionFixedDate: 'not-a-date' })
    expect(r?.getDate()).toBe(31)
  })

  it('accepts string fixed date and uses it', () => {
    const r = computeAuctionDate(lockedOut, { auctionFixedDate: '2027-06-01' })
    expect(r).not.toBeNull()
    expect(r!.toISOString().slice(0, 10)).toBe('2027-06-01')
  })

  it('returns null when offset is zero or negative', () => {
    expect(computeAuctionDate(lockedOut, { auctionDaysAfterLockout: 0 })).toBeNull()
    expect(computeAuctionDate(lockedOut, { auctionDaysAfterLockout: -5 })).toBeNull()
  })
})
