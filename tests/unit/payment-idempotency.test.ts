import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { Types } from 'mongoose'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import Payment from '@/models/Payment'

// The recurring-billing cron relies on the sparse unique index over
// billingPeriodKey to make a concurrent/overlapping sweep fail its pre-charge
// claim (E11000) instead of issuing a duplicate Stripe charge.
describe('Payment billingPeriodKey idempotency', () => {
  beforeAll(async () => {
    await startTestDb()
    await Payment.syncIndexes()
  })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  const claim = (key?: string) => ({
    tenantId: new Types.ObjectId(),
    leaseId: new Types.ObjectId(),
    amount: 8500,
    type: 'rent' as const,
    direction: 'payment' as const,
    status: 'pending' as const,
    balanceAfter: 0,
    billingPeriodKey: key,
  })

  it('rejects a second claim for the same lease+period', async () => {
    const key = 'lease-1:2026-07-01:rent'
    await Payment.create(claim(key))
    await expect(Payment.create(claim(key))).rejects.toMatchObject({ code: 11000 })
  })

  it('allows a different period for the same lease', async () => {
    await Payment.create(claim('lease-1:2026-07-01:rent'))
    await Payment.create(claim('lease-1:2026-08-01:rent'))
    expect(await Payment.countDocuments({})).toBe(2)
  })

  it('does not constrain rows without a billingPeriodKey (sparse)', async () => {
    // Historical imports and manual payments carry no key — many may coexist.
    await Payment.create(claim(undefined))
    await Payment.create(claim(undefined))
    expect(await Payment.countDocuments({})).toBe(2)
  })

  it('lets a retry reuse the period once the failed claim cleared its key', async () => {
    const key = 'lease-2:2026-07-01:rent'
    const first = await Payment.create(claim(key))
    // Simulate the failure path: row kept, key released.
    first.status = 'failed'
    first.billingPeriodKey = undefined
    await first.save()
    // Next sweep can now re-claim the same period.
    await expect(Payment.create(claim(key))).resolves.toBeTruthy()
  })
})
