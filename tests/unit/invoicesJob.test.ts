import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

const { sendTemplatedMock } = vi.hoisted(() => ({ sendTemplatedMock: vi.fn(async () => undefined) }))
vi.mock('@/lib/sendNotification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sendNotification')>('@/lib/sendNotification')
  return { ...actual, sendTemplatedNotification: sendTemplatedMock }
})

import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Payment from '@/models/Payment'
import Settings from '@/models/Settings'
import { runInvoiceGeneration } from '@/jobs/invoices'

/** Pick a billingDay that is exactly daysAhead days from `now`. */
function dayAhead(daysAhead: number): number {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.getDate()
}

describe('jobs/invoices — runInvoiceGeneration', () => {
  beforeAll(async () => {
    await startTestDb()
    // Freeze "now" at midnight so daysBetween() matches the dayAhead helper
    // exactly. The job mixes Date.now() with day-boundary math; without this
    // the floor() rounding flips depending on the time of day the test runs.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 10, 0, 0, 0)) // June 10 2026 midnight
  })
  beforeEach(async () => {
    await clearTestDb()
    sendTemplatedMock.mockClear()
    await Settings.create({ billingDaysBeforeDue: 7 })
  })
  afterAll(async () => {
    vi.useRealTimers()
    await stopTestDb()
  })

  it('creates a pending Payment + sends reminder for manual-pay tenant on the lead day', async () => {
    const { tenant, lease } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { billingDay: dayAhead(7) })
    await Tenant.findByIdAndUpdate(tenant._id, { autopayEnabled: false })

    const results = await runInvoiceGeneration()

    expect(results.find((r) => r.tenantEmail === tenant.email)?.action).toBe('invoice_created')

    const invoices = await Payment.find({ tenantId: tenant._id, type: 'rent', status: 'pending' })
    expect(invoices).toHaveLength(1)
    expect(invoices[0].amount).toBe(lease.monthlyRate)

    expect(sendTemplatedMock).toHaveBeenCalledWith(
      expect.objectContaining({ templateName: 'Invoice Reminder', notificationType: 'payment_reminder' }),
    )
  })

  it('skips invoice creation for autopay tenants but still sends a reminder', async () => {
    const { tenant, lease } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { billingDay: dayAhead(7) })
    await Tenant.findByIdAndUpdate(tenant._id, { autopayEnabled: true })

    const results = await runInvoiceGeneration()
    expect(results.find((r) => r.tenantEmail === tenant.email)?.action).toBe('reminder_sent')
    expect(await Payment.countDocuments({ tenantId: tenant._id, type: 'rent' })).toBe(0)
    expect(sendTemplatedMock).toHaveBeenCalledTimes(1)
  })

  it('does not double-invoice when a pending row already exists for the period', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { billingDay: dayAhead(7) })
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), dayAhead(7))
    await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      stripePaymentIntentId: `inv_${tenant._id}`,
      amount: lease.monthlyRate, currency: 'usd', type: 'rent', status: 'pending',
      periodStart, periodEnd: new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, periodStart.getDate()),
    })

    const results = await runInvoiceGeneration()
    expect(results.find((r) => r.tenantEmail === tenant.email)?.action).toBe('already_invoiced')
    expect(await Payment.countDocuments({ tenantId: tenant._id, type: 'rent' })).toBe(1)
  })

  it('only fires on the EXACT lead-time day (skips off-cycle leases)', async () => {
    const { tenant, lease } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { billingDay: dayAhead(14) }) // 14 days, not 7

    const results = await runInvoiceGeneration()
    expect(results.find((r) => r.tenantEmail === tenant.email)).toBeUndefined()
    expect(sendTemplatedMock).not.toHaveBeenCalled()
  })

  it('skips tenants without an active lease', async () => {
    const { tenant, lease } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { status: 'ended' })

    const results = await runInvoiceGeneration()
    expect(results.find((r) => r.tenantEmail === tenant.email)?.action).toBe('skipped')
  })

  it('respects an admin-set billingDaysBeforeDue override', async () => {
    await Settings.deleteMany({})
    await Settings.create({ billingDaysBeforeDue: 3 })

    const { tenant, lease } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { billingDay: dayAhead(3) })

    await runInvoiceGeneration()
    expect(await Payment.countDocuments({ tenantId: tenant._id, type: 'rent', status: 'pending' })).toBe(1)
  })
})
