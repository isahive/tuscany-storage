import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { Types } from 'mongoose'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant, makeUnit } from '@/tests/helpers/factories'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn(async () => 'msg-1') }))
vi.mock('@/lib/email', () => ({
  sendEmail: sendEmailMock,
  sendAdminNotification: vi.fn(async () => undefined),
}))

import LockoutEvent from '@/models/LockoutEvent'
import Settings from '@/models/Settings'
import { runLockoutReportEmail } from '@/jobs/lockout-report-email'

describe('jobs/lockout-report-email — runLockoutReportEmail', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    sendEmailMock.mockClear()
  })
  afterAll(async () => { await stopTestDb() })

  it('returns sent:false when no notification email is configured', async () => {
    await Settings.create({ notificationEmail: '', facilityEmail: '' })
    const out = await runLockoutReportEmail()
    expect(out).toEqual({ sent: false, count: 0 })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('returns sent:false when there are no events in the last 24h', async () => {
    await Settings.create({ notificationEmail: 'ops@tuscany.test' })
    const out = await runLockoutReportEmail()
    expect(out).toEqual({ sent: false, count: 0 })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('falls back to facilityEmail when notificationEmail is empty', async () => {
    await Settings.create({ notificationEmail: '', facilityEmail: 'facility@tuscany.test' })
    const t = await makeTenant()
    const u = await makeUnit()
    await LockoutEvent.create({
      tenantId: t._id,
      unitId: u._id,
      type: 'locked_out',
      trigger: 'auto',
      createdBy: 'cron',
      createdAt: new Date(),
    })
    const out = await runLockoutReportEmail()
    expect(out.sent).toBe(true)
    expect(sendEmailMock).toHaveBeenCalledWith(
      'facility@tuscany.test',
      expect.stringMatching(/Lock Out Report/i),
      expect.any(String),
    )
  })

  it('sends a digest with sections for locked_out + unlocked events', async () => {
    await Settings.create({ notificationEmail: 'ops@tuscany.test', facilityName: 'Test Facility' })
    const t = await makeTenant({ firstName: 'Ada', lastName: 'Lovelace' })
    const u = await makeUnit({ unitNumber: 'A5' })
    await LockoutEvent.create({ tenantId: t._id, unitId: u._id, type: 'locked_out', trigger: 'auto', createdBy: 'cron', createdAt: new Date() })
    await LockoutEvent.create({ tenantId: t._id, unitId: u._id, type: 'unlocked', trigger: 'manual', createdBy: 'admin-1', createdAt: new Date(), approvedAt: new Date() })

    const out = await runLockoutReportEmail()
    expect(out).toEqual({ sent: true, count: 2 })
    const [, , html] = sendEmailMock.mock.calls[0] as unknown as [string, string, string]
    expect(html).toContain('Ada Lovelace')
    expect(html).toContain('Unit A5')
    expect(html).toContain('Lock-Outs (1)')
    expect(html).toContain('Lock-Out Removals (1)')
    expect(html).toContain('Test Facility')
  })

  it('excludes events older than 24 hours', async () => {
    await Settings.create({ notificationEmail: 'ops@tuscany.test' })
    const t = await makeTenant()
    const u = await makeUnit()
    await LockoutEvent.create({
      tenantId: t._id,
      unitId: u._id,
      type: 'locked_out',
      trigger: 'auto',
      createdBy: 'cron',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    })
    const out = await runLockoutReportEmail()
    expect(out).toEqual({ sent: false, count: 0 })
  })

  it('handles events with missing populated tenantId gracefully', async () => {
    await Settings.create({ notificationEmail: 'ops@tuscany.test' })
    const u = await makeUnit()
    await LockoutEvent.create({
      tenantId: new Types.ObjectId(),
      unitId: u._id,
      type: 'locked_out',
      trigger: 'auto',
      createdBy: 'cron',
      createdAt: new Date(),
    })
    const out = await runLockoutReportEmail()
    expect(out.sent).toBe(true)
    const [, , html] = sendEmailMock.mock.calls[0] as unknown as [string, string, string]
    expect(html).toContain('Unknown tenant')
  })
})
