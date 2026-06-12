import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

// Stub all outbound integrations — delinquency triggers templates, gate
// controller calls, and print queue writes.
const {
  sendTemplatedMock,
  grantAccessMock,
  revokeAccessMock,
} = vi.hoisted(() => ({
  sendTemplatedMock: vi.fn(async () => undefined),
  grantAccessMock: vi.fn(async () => undefined),
  revokeAccessMock: vi.fn(async () => undefined),
}))
vi.mock('@/lib/sendNotification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sendNotification')>('@/lib/sendNotification')
  return { ...actual, sendTemplatedNotification: sendTemplatedMock }
})
vi.mock('@/lib/gateController', () => ({
  grantAccess: grantAccessMock,
  revokeAccess: revokeAccessMock,
}))

import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import Settings from '@/models/Settings'
import LockoutEvent from '@/models/LockoutEvent'
import { runDelinquency } from '@/jobs/delinquency'

describe('jobs/delinquency — runDelinquency', () => {
  beforeAll(async () => {
    await startTestDb()
    vi.useFakeTimers()
    // Pick a date in the middle of a month so all the day-math is unambiguous.
    vi.setSystemTime(new Date(2026, 5, 20, 0, 0, 0)) // June 20 2026
  })
  beforeEach(async () => {
    await clearTestDb()
    sendTemplatedMock.mockClear()
    grantAccessMock.mockClear()
    revokeAccessMock.mockClear()
    await Settings.create({
      lateFeeAmount: 2500,
      lateFeeAfterDays: 5,
      gateAutoLockout: true,
    })
  })
  afterAll(async () => {
    vi.useRealTimers()
    await stopTestDb()
  })

  it('skips tenants without an active lease', async () => {
    const { tenant } = await makeRentedTenant({ leaseOpts: { status: 'ended' } })
    const out = await runDelinquency()
    expect(out.find((r) => r.tenantEmail === tenant.email)).toBeUndefined()
  })

  it('grace period — under lateFeeAfterDays, no action', async () => {
    const { tenant } = await makeRentedTenant({
      tenantOpts: { balance: 10000 },
      leaseOpts: { billingDay: 18 }, // 2 days ago — under default 5 day grace
    })
    const out = await runDelinquency()
    expect(out.find((r) => r.tenantEmail === tenant.email)).toBeUndefined()
    expect(await Payment.countDocuments({ tenantId: tenant._id, type: 'late_fee' })).toBe(0)
  })

  it('marks tenant delinquent and creates a late fee row at the late-day boundary', async () => {
    const { tenant } = await makeRentedTenant({
      tenantOpts: { balance: 10000 }, // June rent charged, unpaid
      leaseOpts: { billingDay: 13 }, // 7 days ago — past late (5) but before lockout (10)
    })
    const out = await runDelinquency()

    const updated = await Tenant.findById(tenant._id)
    expect(updated!.status).toBe('delinquent')

    const lateFees = await Payment.find({ tenantId: tenant._id, type: 'late_fee' })
    expect(lateFees).toHaveLength(1)
    expect(lateFees[0].amount).toBe(2500)
    expect(lateFees[0].direction).toBe('charge')

    expect(out.find((r) => r.tenantEmail === tenant.email)?.action).toBe('marked_delinquent_late_fee_added')
  })

  it('honors lateFeeExempt — escalates status without writing a fee row', async () => {
    const { tenant } = await makeRentedTenant({
      tenantOpts: { lateFeeExempt: true, balance: 10000 },
      leaseOpts: { billingDay: 13 },
    })
    const out = await runDelinquency()

    expect((await Tenant.findById(tenant._id))!.status).toBe('delinquent')
    expect(await Payment.countDocuments({ tenantId: tenant._id, type: 'late_fee' })).toBe(0)
    expect(out.find((r) => r.tenantEmail === tenant.email)?.action).toBe('marked_delinquent_fee_skipped_exempt')
  })

  it('restores a delinquent tenant to active when a payment for the current period exists', async () => {
    const { tenant, lease, unit } = await makeRentedTenant({
      tenantOpts: { status: 'delinquent', balance: 10000 },
      leaseOpts: { billingDay: 10 },
    })
    // Payment row covering the current period
    const periodStart = new Date(2026, 5, 10)
    await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      stripePaymentIntentId: `paid_${tenant._id}`,
      amount: 10000, currency: 'usd', type: 'rent', status: 'succeeded',
      direction: 'payment',
      periodStart, periodEnd: new Date(2026, 6, 10),
    })
    const out = await runDelinquency()

    expect((await Tenant.findById(tenant._id))!.status).toBe('active')
    expect(out.find((r) => r.tenantEmail === tenant.email)?.action).toBe('restored_to_active')
  })

  it('restores a locked_out tenant + writes an unlocked LockoutEvent and grants gate access', async () => {
    const { tenant, lease, unit } = await makeRentedTenant({
      tenantOpts: { status: 'locked_out', balance: 10000 },
      leaseOpts: { billingDay: 10 },
    })
    await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      stripePaymentIntentId: `paid_${tenant._id}`,
      amount: 10000, currency: 'usd', type: 'rent', status: 'succeeded',
      direction: 'payment',
      periodStart: new Date(2026, 5, 10), periodEnd: new Date(2026, 6, 10),
    })

    await runDelinquency()

    expect((await Tenant.findById(tenant._id))!.status).toBe('active')
    expect(grantAccessMock).toHaveBeenCalledTimes(1)
    const lockoutLogs = await LockoutEvent.find({ tenantId: tenant._id, type: 'unlocked' })
    expect(lockoutLogs).toHaveLength(1)
    expect(lockoutLogs[0].trigger).toBe('auto')
  })

  it('restores a locked_out tenant with balance ≤ 0 even without periodStart payment rows, and clears the auction date', async () => {
    // Imported billing histories don't always carry periodStart — a tenant
    // with nothing outstanding must never stay escalated.
    const { tenant, lease } = await makeRentedTenant({
      tenantOpts: { status: 'locked_out', balance: -12790 },
      leaseOpts: { billingDay: 1, auctionDate: new Date(2026, 6, 10), auctionScheduledAt: new Date(2026, 5, 10) },
    })
    const out = await runDelinquency()

    expect((await Tenant.findById(tenant._id))!.status).toBe('active')
    const freshLease = await Lease.findById(lease._id)
    expect(freshLease!.auctionDate).toBeUndefined()
    expect(freshLease!.auctionScheduledAt).toBeUndefined()
    expect(out.find((r) => r.tenantEmail === tenant.email)?.action).toBe('restored_to_active')
  })

  it('does not treat a succeeded rent CHARGE row as a payment — still escalates', async () => {
    const { tenant, lease, unit } = await makeRentedTenant({
      tenantOpts: { balance: 10000 },
      leaseOpts: { billingDay: 13 },
    })
    // An invoiced-but-unpaid rent charge for the current period
    await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      stripePaymentIntentId: `charge_${tenant._id}`,
      amount: 10000, currency: 'usd', type: 'rent', status: 'succeeded',
      direction: 'charge',
      periodStart: new Date(2026, 5, 13), periodEnd: new Date(2026, 6, 13),
    })
    await runDelinquency()

    expect((await Tenant.findById(tenant._id))!.status).toBe('delinquent')
  })

  it('skips a lease that started after the current billing date (fresh move-in)', async () => {
    const { tenant } = await makeRentedTenant({
      tenantOpts: { balance: 10000 },
      leaseOpts: { billingDay: 1, startDate: new Date(2026, 5, 15) }, // moved in June 15, billing day June 1
    })
    const out = await runDelinquency()

    expect((await Tenant.findById(tenant._id))!.status).toBe('active')
    expect(out.find((r) => r.tenantEmail === tenant.email)).toBeUndefined()
    expect(await Payment.countDocuments({ tenantId: tenant._id, type: 'late_fee' })).toBe(0)
  })
})
