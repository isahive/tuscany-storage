import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant, makeTenant } from '@/tests/helpers/factories'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import { buildTenantGroupFilter } from './tenantGroupResolver'

describe('buildTenantGroupFilter', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('returns null when no group or "all" is passed', async () => {
    expect(await buildTenantGroupFilter(null)).toBeNull()
    expect(await buildTenantGroupFilter(undefined)).toBeNull()
    expect(await buildTenantGroupFilter('all')).toBeNull()
  })

  it('returns null for an unknown group id', async () => {
    expect(await buildTenantGroupFilter('not-a-real-group')).toBeNull()
  })

  it('active = role:tenant and not archived', async () => {
    expect(await buildTenantGroupFilter('active')).toEqual({
      role: 'tenant',
      archived: { $ne: true },
    })
  })

  it('recurring = autopayEnabled', async () => {
    expect(await buildTenantGroupFilter('recurring')).toEqual({ autopayEnabled: true })
  })

  it('outstanding = balance > 0', async () => {
    expect(await buildTenantGroupFilter('outstanding')).toEqual({ balance: { $gt: 0 } })
  })

  it('late = status:delinquent', async () => {
    expect(await buildTenantGroupFilter('late')).toEqual({ status: 'delinquent' })
  })

  it('archived = archived:true', async () => {
    expect(await buildTenantGroupFilter('archived')).toEqual({ archived: true })
  })

  it('locked_out = status:locked_out', async () => {
    expect(await buildTenantGroupFilter('locked_out')).toEqual({ status: 'locked_out' })
  })

  it('waiting_list = onWaitingList:true', async () => {
    expect(await buildTenantGroupFilter('waiting_list')).toEqual({ onWaitingList: true })
  })

  it('current resolves to tenants with active or pending_moveout leases', async () => {
    const { tenant: t1 } = await makeRentedTenant()
    const { tenant: t2 } = await makeRentedTenant()
    await makeTenant() // not rented, should be excluded

    const filter = await buildTenantGroupFilter('current') as { _id: { $in: any[] } }
    const ids = filter._id.$in.map((x) => String(x))
    expect(ids).toEqual(expect.arrayContaining([String(t1._id), String(t2._id)]))
    expect(ids).toHaveLength(2)
  })

  it('non_recurring = currently renting AND autopay disabled', async () => {
    const { tenant } = await makeRentedTenant({ tenantOpts: { autopayEnabled: false } })
    const filter = await buildTenantGroupFilter('non_recurring') as {
      _id: { $in: any[] }
      autopayEnabled: { $ne: boolean }
    }
    expect(filter.autopayEnabled).toEqual({ $ne: true })
    expect(filter._id.$in.map(String)).toContain(String(tenant._id))
  })

  it('past_due includes tenants with a pending charge whose dueDate is past', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    await Payment.create({
      tenantId: tenant._id,
      leaseId: lease._id,
      unitId: unit._id,
      type: 'rent',
      status: 'pending',
      direction: 'charge',
      amount: 10000,
      currency: 'usd',
      dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
      stripePaymentIntentId: `test_pi_${tenant._id}`,
    })
    const filter = await buildTenantGroupFilter('past_due') as { _id: { $in: any[] } }
    expect(filter._id.$in.map(String)).toContain(String(tenant._id))
  })

  it('auction_date_set resolves through Lease.auctionDate', async () => {
    const { tenant, lease } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { auctionDate: new Date('2026-12-01') })
    const filter = await buildTenantGroupFilter('auction_date_set') as { _id: { $in: any[] } }
    expect(filter._id.$in.map(String)).toContain(String(tenant._id))
  })

  it('tenant_protection_plans + active_insurance_policies resolve to leases with a protection plan', async () => {
    const { tenant, lease } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { protectionPlanId: '507f1f77bcf86cd799439099' })

    for (const g of ['tenant_protection_plans', 'active_insurance_policies'] as const) {
      const filter = await buildTenantGroupFilter(g) as { _id: { $in: any[] } }
      expect(filter._id.$in.map(String)).toContain(String(tenant._id))
    }
  })

  it('tenant_protection_eligible includes leases without a plan', async () => {
    const { tenant } = await makeRentedTenant()
    const filter = await buildTenantGroupFilter('tenant_protection_eligible') as { _id: { $in: any[] } }
    expect(filter._id.$in.map(String)).toContain(String(tenant._id))
  })

  it('late_fee_exempt and tax_exempt map to their flag', async () => {
    expect(await buildTenantGroupFilter('late_fee_exempt')).toEqual({ lateFeeExempt: true })
    expect(await buildTenantGroupFilter('tax_exempt')).toEqual({ taxExempt: true })
  })

  it('automatic_lockout_disabled maps to automaticLockoutEnabled:false', async () => {
    expect(await buildTenantGroupFilter('automatic_lockout_disabled')).toEqual({
      automaticLockoutEnabled: false,
    })
  })
})
