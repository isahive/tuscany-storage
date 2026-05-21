import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant, makeUnit } from '@/tests/helpers/factories'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import Settings from '@/models/Settings'
import { runRateManagement } from '@/jobs/rate-management'
import RateChange from '@/models/RateChange'
import Lease from '@/models/Lease'

describe('jobs/rate-management — runRateManagement', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('returns null when rate management is disabled', async () => {
    await Settings.create({ rateManagementEnabled: false })
    const out = await runRateManagement()
    expect(out).toBeNull()
  })

  it('returns the suggestion shape when enabled, no rules', async () => {
    await Settings.create({
      rateManagementEnabled: true,
      unitTypePriceRules: [],
      rentalPriceRules: [],
    })
    const out = await runRateManagement()
    expect(out).not.toBeNull()
    expect(out!.rentalSuggestions).toEqual([])
    expect(out!.unitTypeSuggestions).toEqual([])
    expect(out!.proposals).toEqual([])
  })

  it('produces proposals + RateChange rows for matching leases under a rental rule', async () => {
    // Long-tenure lease — > minMonthsSinceLastChange
    const { lease, unit } = await makeRentedTenant({
      leaseOpts: {
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2), // 2 years ago
        monthlyRate: 10000,
      },
    })
    // A couple of comparable units at higher price so the median exceeds 10000
    await makeUnit({ type: 'standard', price: 12000 })
    await makeUnit({ type: 'standard', price: 13000 })

    await Settings.create({
      rateManagementEnabled: true,
      rentalPriceAdvanceNoticeDays: 30,
      rentalPriceAllowExceedingStreetRate: false,
      rentalPriceRoundToNearestDollar: true,
      unitTypePriceRules: [],
      rentalPriceRules: [{
        id: 'r-1',
        unitType: 'standard',
        increasePercent: 10,
        minMonthsSinceLastChange: 12,
      }],
    })

    const out = await runRateManagement()
    expect(out!.proposals.length).toBeGreaterThanOrEqual(1)
    const proposal = out!.proposals.find((p) => p.leaseId === lease._id.toString())
    expect(proposal).toBeDefined()
    expect(proposal!.unitNumber).toBe(unit.unitNumber)

    // Persisted as RateChange
    const rateChanges = await RateChange.find({ leaseId: lease._id })
    expect(rateChanges.length).toBeGreaterThanOrEqual(1)
  })

  it('skips leases that are exempt from rate management', async () => {
    const { lease } = await makeRentedTenant({
      leaseOpts: {
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2),
        monthlyRate: 10000,
        exemptFromRateManagement: true,
      },
    })
    await makeUnit({ type: 'standard', price: 12000 })

    await Settings.create({
      rateManagementEnabled: true,
      unitTypePriceRules: [],
      rentalPriceRules: [{
        id: 'r-2',
        unitType: 'standard',
        increasePercent: 10,
        minMonthsSinceLastChange: 12,
      }],
    })

    const out = await runRateManagement()
    expect(out!.proposals.find((p) => p.leaseId === lease._id.toString())).toBeUndefined()
  })

  it('produces unit-type street-rate suggestions when a unitTypePriceRule is configured', async () => {
    // Three units at occupied/available mix to drive occupancyPct
    await makeUnit({ type: 'standard', price: 10000, status: 'occupied' })
    await makeUnit({ type: 'standard', price: 10000, status: 'occupied' })
    await makeUnit({ type: 'standard', price: 10000, status: 'available' })

    await Settings.create({
      rateManagementEnabled: true,
      unitTypePriceRules: [{
        id: 'ut-1',
        unitType: 'standard',
        increasePercent: 5,
        minOccupancyPct: 50,
        roundingRule: 'nearest_dollar',
      }],
      rentalPriceRules: [],
    })

    const out = await runRateManagement()
    expect(out!.unitTypeSuggestions.length).toBeGreaterThanOrEqual(1)
    expect(out!.unitTypeSuggestions[0].unitType).toBe('standard')
  })

  it('does not double-propose a RateChange already pending for a lease', async () => {
    const { lease } = await makeRentedTenant({
      leaseOpts: {
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 2),
        monthlyRate: 10000,
      },
    })
    await makeUnit({ type: 'standard', price: 12000 })

    // Pre-existing proposed change
    await RateChange.create({
      leaseId: lease._id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      currentRate: 10000,
      proposedRate: 11000,
      status: 'proposed',
      effectiveDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
      source: 'rate_management',
    })

    await Settings.create({
      rateManagementEnabled: true,
      unitTypePriceRules: [],
      rentalPriceRules: [{
        id: 'r-3',
        unitType: 'standard',
        increasePercent: 10,
        minMonthsSinceLastChange: 12,
      }],
    })

    await runRateManagement()
    const after = await RateChange.find({ leaseId: lease._id, status: 'proposed' })
    expect(after).toHaveLength(1)
    void Lease
  })
})
