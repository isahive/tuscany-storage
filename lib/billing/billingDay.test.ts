import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant, makeUnit, makeLease } from '@/tests/helpers/factories'
import Lease from '@/models/Lease'
import { computeBillingDay, realignAllLeaseBillingDays } from './billingDay'

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

describe('realignAllLeaseBillingDays', () => {
  beforeAll(async () => { await startTestDb() })
  afterAll(async () => { await stopTestDb() })
  beforeEach(async () => { await clearTestDb() })

  async function seedActiveLease(billingDay: number, startDate: Date) {
    const t = await makeTenant()
    const u = await makeUnit()
    return makeLease(t._id, u._id, { billingDay, startDate, status: 'active' })
  }

  async function seedInactiveLease(billingDay: number) {
    const t = await makeTenant()
    const u = await makeUnit()
    return makeLease(t._id, u._id, { billingDay, status: 'ended' })
  }

  it('switches every active lease to day 1 when anchor=first_of_month', async () => {
    await seedActiveLease(10, new Date('2026-05-10T00:00:00Z'))
    await seedActiveLease(28, new Date('2026-04-28T00:00:00Z'))
    await seedActiveLease(1,  new Date('2026-03-01T00:00:00Z')) // already aligned

    const res = await realignAllLeaseBillingDays(s('first_of_month'))
    expect(res.scanned).toBe(3)
    expect(res.changed).toBe(2)

    const days = (await Lease.find({}).select('billingDay').lean<{ billingDay: number }[]>())
      .map((l) => l.billingDay)
    expect(days.every((d) => d === 1)).toBe(true)
  })

  it('switches to the configured custom day when anchor=custom_day', async () => {
    await seedActiveLease(10, new Date('2026-05-10T00:00:00Z'))
    await seedActiveLease(28, new Date('2026-04-28T00:00:00Z'))

    const res = await realignAllLeaseBillingDays(s('custom_day', 15))
    expect(res.changed).toBe(2)

    const days = (await Lease.find({}).select('billingDay').lean<{ billingDay: number }[]>())
      .map((l) => l.billingDay)
    expect(days.every((d) => d === 15)).toBe(true)
  })

  it('restores each lease to its own signup day when anchor=signup_day', async () => {
    const l1 = await seedActiveLease(1, new Date('2026-05-10T00:00:00Z'))
    const l2 = await seedActiveLease(1, new Date('2026-04-28T00:00:00Z'))
    const l3 = await seedActiveLease(1, new Date('2026-03-31T00:00:00Z')) // 31 → clamps to 28

    const res = await realignAllLeaseBillingDays(s('signup_day'))
    expect(res.changed).toBe(3)

    const after1 = await Lease.findById(l1._id).lean<{ billingDay: number }>()
    const after2 = await Lease.findById(l2._id).lean<{ billingDay: number }>()
    const after3 = await Lease.findById(l3._id).lean<{ billingDay: number }>()
    expect(after1!.billingDay).toBe(10)
    expect(after2!.billingDay).toBe(28)
    expect(after3!.billingDay).toBe(28)
  })

  it('ignores inactive leases (ended, moved_out, etc.)', async () => {
    await seedActiveLease(10, new Date('2026-05-10T00:00:00Z'))
    const ended = await seedInactiveLease(20)

    await realignAllLeaseBillingDays(s('first_of_month'))

    const after = await Lease.findById(ended._id).lean<{ billingDay: number }>()
    expect(after!.billingDay).toBe(20) // untouched
  })

  it('no-ops cleanly when nothing differs (idempotent)', async () => {
    await seedActiveLease(1, new Date('2026-05-01T00:00:00Z'))
    await seedActiveLease(1, new Date('2026-04-01T00:00:00Z'))

    const res = await realignAllLeaseBillingDays(s('first_of_month'))
    expect(res.scanned).toBe(2)
    expect(res.changed).toBe(0)
  })
})
