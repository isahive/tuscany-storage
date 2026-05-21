import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn(async () => 'msg-1') }))
vi.mock('@/lib/email', () => ({
  sendEmail: sendEmailMock,
  sendAdminNotification: vi.fn(async () => undefined),
}))

import Settings from '@/models/Settings'
import { runRateManagementReminder } from '@/jobs/rate-management-reminder'

describe('jobs/rate-management-reminder — runRateManagementReminder', () => {
  beforeAll(async () => {
    await startTestDb()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 10, 9, 0, 0)) // June 10 2026 — pick this as reminder day
  })
  beforeEach(async () => {
    await clearTestDb()
    sendEmailMock.mockClear()
  })
  afterAll(async () => {
    vi.useRealTimers()
    await stopTestDb()
  })

  it('returns disabled when rate management is off', async () => {
    await Settings.create({ rateManagementEnabled: false, rateManagementReminderDay: 10 })
    const out = await runRateManagementReminder()
    expect(out).toEqual({ sent: false, reason: 'disabled' })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('returns not_reminder_day when today is not the configured day', async () => {
    await Settings.create({
      rateManagementEnabled: true,
      rateManagementReminderDay: 5, // today is the 10th, not the 5th
      notificationEmail: 'ops@x.com',
    })
    const out = await runRateManagementReminder()
    expect(out).toEqual({ sent: false, reason: 'not_reminder_day' })
  })

  it('returns no_notification_email when neither notification nor facility email is set', async () => {
    await Settings.create({
      rateManagementEnabled: true,
      rateManagementReminderDay: 10,
      notificationEmail: '',
      facilityEmail: '',
    })
    const out = await runRateManagementReminder()
    expect(out).toEqual({ sent: false, reason: 'no_notification_email' })
  })

  it('falls back to facilityEmail when notificationEmail is blank', async () => {
    await Settings.create({
      rateManagementEnabled: true,
      rateManagementReminderDay: 10,
      notificationEmail: '',
      facilityEmail: 'facility@x.com',
    })
    const out = await runRateManagementReminder()
    expect(out).toEqual({ sent: true })
    expect(sendEmailMock).toHaveBeenCalledWith(
      'facility@x.com',
      expect.stringMatching(/Rate Management/i),
      expect.any(String),
    )
  })

  it('sends to notificationEmail on the configured day', async () => {
    await Settings.create({
      rateManagementEnabled: true,
      rateManagementReminderDay: 10,
      notificationEmail: 'ops@x.com',
      facilityName: 'Test Facility',
    })
    const out = await runRateManagementReminder()
    expect(out).toEqual({ sent: true })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const [, , html] = sendEmailMock.mock.calls[0] as unknown as [string, string, string]
    expect(html).toContain('Test Facility')
    expect(html).toContain('Rate Management Summary')
  })
})
