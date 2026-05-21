import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

const { sendTemplatedMock } = vi.hoisted(() => ({
  sendTemplatedMock: vi.fn(async () => undefined),
}))
vi.mock('@/lib/sendNotification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sendNotification')>('@/lib/sendNotification')
  return { ...actual, sendTemplatedNotification: sendTemplatedMock }
})

import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Notification from '@/models/Notification'
import { runReminders } from '@/jobs/reminders'

function dayThreeFromNow(): number {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return d.getDate()
}

describe('jobs/reminders — runReminders', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); sendTemplatedMock.mockClear() })
  afterAll(async () => { await stopTestDb() })

  it('sends the Invoice Reminder template for tenants whose billingDay is D+3', async () => {
    const { lease } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { billingDay: dayThreeFromNow() })

    await runReminders()

    expect(sendTemplatedMock).toHaveBeenCalledTimes(1)
    expect((sendTemplatedMock.mock.calls[0] as unknown as unknown[])[0]).toMatchObject({
      templateName: 'Invoice Reminder',
      notificationType: 'payment_reminder',
    })
  })

  it('skips leases whose billingDay is not exactly D+3', async () => {
    const { lease } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { billingDay: ((dayThreeFromNow() + 5) % 28) + 1 })

    await runReminders()
    expect(sendTemplatedMock).not.toHaveBeenCalled()
  })

  it('skips when a payment_reminder notification already exists this month', async () => {
    const { lease, tenant } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { billingDay: dayThreeFromNow() })
    const startOfMonth = new Date(); startOfMonth.setDate(1)
    await Notification.create({
      tenantId: tenant._id,
      type: 'payment_reminder',
      channel: 'email',
      subject: 'prior',
      body: 'prior',
      status: 'sent',
      sentAt: startOfMonth,
      createdAt: startOfMonth,
    })

    await runReminders()
    expect(sendTemplatedMock).not.toHaveBeenCalled()
  })

  it('skips moved-out tenants even if billingDay matches', async () => {
    const { lease, tenant } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { billingDay: dayThreeFromNow() })
    await Tenant.findByIdAndUpdate(tenant._id, { status: 'moved_out' })

    await runReminders()
    expect(sendTemplatedMock).not.toHaveBeenCalled()
  })

  it('skips inactive leases', async () => {
    const { lease } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { billingDay: dayThreeFromNow(), status: 'ended' })

    await runReminders()
    expect(sendTemplatedMock).not.toHaveBeenCalled()
  })

  it('continues processing after a send failure (per-tenant error isolation)', async () => {
    const { lease: l1 } = await makeRentedTenant()
    const { lease: l2 } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(l1._id, { billingDay: dayThreeFromNow() })
    await Lease.findByIdAndUpdate(l2._id, { billingDay: dayThreeFromNow() })

    sendTemplatedMock.mockImplementationOnce(async () => { throw new Error('Resend 500') })
    await runReminders()
    // First throws — but Notification.findOne was already negative, then send threw.
    // Second proceeds normally.
    expect(sendTemplatedMock).toHaveBeenCalledTimes(2)
  })
})
