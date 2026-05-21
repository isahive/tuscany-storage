import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import RateChange from '@/models/RateChange'
import Lease from '@/models/Lease'
import { runRateExecution } from '@/jobs/rate-execution'

describe('jobs/rate-execution — runRateExecution', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('does nothing when no approved changes are due', async () => {
    const out = await runRateExecution()
    expect(out).toEqual([])
  })

  it('applies an approved change with effectiveDate in the past', async () => {
    const { lease } = await makeRentedTenant({ leaseOpts: { monthlyRate: 10000 } })
    const change = await RateChange.create({
      leaseId: lease._id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      currentRate: 10000,
      proposedRate: 11500,
      status: 'approved',
      effectiveDate: new Date(Date.now() - 60_000), // 1 minute ago
      source: 'rate_management',
    })

    const out = await runRateExecution()
    expect(out).toHaveLength(1)
    expect(out[0].newRate).toBe(11500)

    const updatedLease = await Lease.findById(lease._id)
    expect(updatedLease!.monthlyRate).toBe(11500)
    expect(updatedLease!.lastRateChangeDate).toBeInstanceOf(Date)

    const updatedChange = await RateChange.findById(change._id)
    expect(updatedChange!.status).toBe('executed')
    expect(updatedChange!.executedAt).toBeInstanceOf(Date)
  })

  it('does not apply changes with future effectiveDate', async () => {
    const { lease } = await makeRentedTenant({ leaseOpts: { monthlyRate: 10000 } })
    await RateChange.create({
      leaseId: lease._id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      currentRate: 10000,
      proposedRate: 11500,
      status: 'approved',
      effectiveDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      source: 'rate_management',
    })
    const out = await runRateExecution()
    expect(out).toHaveLength(0)
    expect((await Lease.findById(lease._id))!.monthlyRate).toBe(10000)
  })

  it('marks change executed but skips the lease when lease is no longer active', async () => {
    const { lease } = await makeRentedTenant({ leaseOpts: { monthlyRate: 10000, status: 'ended' } })
    const change = await RateChange.create({
      leaseId: lease._id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      currentRate: 10000,
      proposedRate: 11500,
      status: 'approved',
      effectiveDate: new Date(Date.now() - 60_000),
      source: 'rate_management',
    })

    await runRateExecution()
    const updated = await RateChange.findById(change._id)
    expect(updated!.status).toBe('executed')
    expect(updated!.rejectionReason).toMatch(/lease inactive/i)
    // lease's monthly rate was not touched
    expect((await Lease.findById(lease._id))!.monthlyRate).toBe(10000)
  })

  it('ignores changes still in "proposed" or "rejected" status', async () => {
    const { lease } = await makeRentedTenant({ leaseOpts: { monthlyRate: 10000 } })
    await RateChange.create({
      leaseId: lease._id, tenantId: lease.tenantId, unitId: lease.unitId,
      currentRate: 10000, proposedRate: 12000,
      status: 'proposed',
      effectiveDate: new Date(Date.now() - 60_000),
      source: 'rate_management',
    })
    await RateChange.create({
      leaseId: lease._id, tenantId: lease.tenantId, unitId: lease.unitId,
      currentRate: 10000, proposedRate: 13000,
      status: 'rejected',
      effectiveDate: new Date(Date.now() - 60_000),
      source: 'rate_management',
    })
    const out = await runRateExecution()
    expect(out).toHaveLength(0)
    expect((await Lease.findById(lease._id))!.monthlyRate).toBe(10000)
  })
})
