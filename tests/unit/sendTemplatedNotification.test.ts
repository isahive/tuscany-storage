/**
 * Tests for the dispatch + Notification.status book-keeping of
 * sendTemplatedNotification. The previous behavior marked every notification
 * as "sent" regardless of whether sendEmail/sendSMS actually succeeded —
 * silent failures that left admins thinking tenants had been notified. The
 * function now mirrors actual dispatch outcomes into Notification.status
 * ("sent" if at least one channel succeeded, "failed" if all attempts threw).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'

const dispatchMocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendSMS: vi.fn(),
}))
vi.mock('@/lib/email', () => ({ sendEmail: dispatchMocks.sendEmail }))
vi.mock('@/lib/twilio', () => ({ sendSMS: dispatchMocks.sendSMS, default: () => null }))

import { sendTemplatedNotification } from '@/lib/sendNotification'
import NotificationTemplate from '@/models/NotificationTemplate'
import Notification from '@/models/Notification'

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })

beforeEach(async () => {
  await clearTestDb()
  dispatchMocks.sendEmail.mockReset()
  dispatchMocks.sendSMS.mockReset()
})

async function seedTemplate(over: Record<string, unknown> = {}) {
  return NotificationTemplate.create({
    name: 'Test Template',
    type: 'custom',
    emailSubject: 'Hello [[CUSTOMER_NAME]]',
    emailContent: '<p>Body for [[CUSTOMER_NAME]]</p>',
    textContent: 'SMS for [[CUSTOMER_NAME]]',
    emailEnabled: true,
    textEnabled: true,
    active: true,
    ...over,
  })
}

describe('sendTemplatedNotification — happy path', () => {
  it('records a "sent" Notification when both channels succeed', async () => {
    await seedTemplate()
    const tenant = await makeTenant({ email: 'a@a.com', phone: '555-0001' })
    dispatchMocks.sendEmail.mockResolvedValueOnce('resend-msg-1')
    dispatchMocks.sendSMS.mockResolvedValueOnce('twilio-sid-1')

    await sendTemplatedNotification({
      templateName: 'Test Template',
      notificationType: 'custom',
      tenant,
    })

    const notes = await Notification.find({ tenantId: tenant._id })
    expect(notes).toHaveLength(1)
    expect(notes[0].status).toBe('sent')
    expect(notes[0].channel).toBe('both')
    expect(notes[0].sentAt).toBeInstanceOf(Date)
    expect(notes[0].resendMessageId).toBe('resend-msg-1')
    expect(notes[0].twilioMessageSid).toBe('twilio-sid-1')
    expect(notes[0].failureReason).toBeUndefined()
  })

  it('records a "sent" Notification when only one channel was requested and succeeded', async () => {
    await seedTemplate()
    const tenant = await makeTenant({ email: 'a@a.com', phone: '555-0001' })
    dispatchMocks.sendEmail.mockResolvedValueOnce('resend-msg-2')

    await sendTemplatedNotification({
      templateName: 'Test Template',
      notificationType: 'custom',
      tenant,
      channels: 'email',
    })

    const notes = await Notification.find({ tenantId: tenant._id })
    expect(notes).toHaveLength(1)
    expect(notes[0].status).toBe('sent')
    expect(notes[0].channel).toBe('email')
    expect(dispatchMocks.sendSMS).not.toHaveBeenCalled()
  })
})

describe('sendTemplatedNotification — partial failure', () => {
  it('records "sent" when one channel succeeds and the other throws', async () => {
    await seedTemplate()
    const tenant = await makeTenant({ email: 'a@a.com', phone: '555-0001' })
    dispatchMocks.sendEmail.mockResolvedValueOnce('ok-1')
    dispatchMocks.sendSMS.mockRejectedValueOnce(new Error('Twilio not configured'))

    await sendTemplatedNotification({
      templateName: 'Test Template',
      notificationType: 'custom',
      tenant,
    })

    const notes = await Notification.find({ tenantId: tenant._id })
    expect(notes).toHaveLength(1)
    expect(notes[0].status).toBe('sent') // at least one channel went out
    expect(notes[0].resendMessageId).toBe('ok-1')
    expect(notes[0].twilioMessageSid).toBeUndefined()
  })
})

describe('sendTemplatedNotification — total failure (silent-failure regression guard)', () => {
  it('records "failed" with failureReason when both channels throw', async () => {
    await seedTemplate()
    const tenant = await makeTenant({ email: 'a@a.com', phone: '555-0001' })
    dispatchMocks.sendEmail.mockRejectedValueOnce(new Error('Email service not configured'))
    dispatchMocks.sendSMS.mockRejectedValueOnce(new Error('SMS service not configured'))

    await sendTemplatedNotification({
      templateName: 'Test Template',
      notificationType: 'custom',
      tenant,
    })

    const notes = await Notification.find({ tenantId: tenant._id })
    expect(notes).toHaveLength(1)
    expect(notes[0].status).toBe('failed')
    expect(notes[0].sentAt).toBeUndefined()
    expect(notes[0].failureReason).toMatch(/Email service not configured/)
    expect(notes[0].failureReason).toMatch(/SMS service not configured/)
  })

  it('records "failed" when the only requested channel throws', async () => {
    await seedTemplate()
    const tenant = await makeTenant({ email: 'a@a.com', phone: '555-0001' })
    dispatchMocks.sendSMS.mockRejectedValueOnce(new Error('Twilio down'))

    await sendTemplatedNotification({
      templateName: 'Test Template',
      notificationType: 'custom',
      tenant,
      channels: 'sms',
    })

    const notes = await Notification.find({ tenantId: tenant._id })
    expect(notes).toHaveLength(1)
    expect(notes[0].status).toBe('failed')
    expect(notes[0].failureReason).toMatch(/Twilio down/)
  })
})

describe('sendTemplatedNotification — nothing to send', () => {
  it('does not create a Notification when both channels are disabled by the template', async () => {
    await seedTemplate({ emailEnabled: false, textEnabled: false })
    const tenant = await makeTenant({ email: 'a@a.com', phone: '555-0001' })

    await sendTemplatedNotification({
      templateName: 'Test Template',
      notificationType: 'custom',
      tenant,
    })

    expect(await Notification.countDocuments()).toBe(0)
    expect(dispatchMocks.sendEmail).not.toHaveBeenCalled()
    expect(dispatchMocks.sendSMS).not.toHaveBeenCalled()
  })

})
