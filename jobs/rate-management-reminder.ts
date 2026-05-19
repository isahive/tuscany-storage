import { connectDB } from '@/lib/db'
import { getSettings } from '@/lib/getSettings'
import { sendEmail } from '@/lib/email'
import { isReminderDay } from '@/lib/rateManagement'

/**
 * Storable's optional monthly Rate Management reminder email.
 *
 * Runs daily; only actually sends when:
 *   - rateManagementEnabled is true
 *   - today is the configured rateManagementReminderDay (clamped to month end)
 *   - notificationEmail is configured
 *
 * Idempotency is not needed across runs because the cron fires once per day.
 * If a deployment runs it twice in the same day the recipient gets two copies
 * — acceptable trade-off vs. building a sent-today persistence layer.
 */
export async function runRateManagementReminder(): Promise<{ sent: boolean; reason?: string }> {
  await connectDB()
  const settings = await getSettings()

  if (!settings.rateManagementEnabled) {
    return { sent: false, reason: 'disabled' }
  }

  const reminderDay = settings.rateManagementReminderDay ?? 1
  if (!isReminderDay(new Date(), reminderDay)) {
    return { sent: false, reason: 'not_reminder_day' }
  }

  const to = settings.notificationEmail || settings.facilityEmail
  if (!to) {
    return { sent: false, reason: 'no_notification_email' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const summaryUrl = `${appUrl}/admin/rate-management`

  await sendEmail(
    to,
    'Rate Management — Monthly Review Reminder',
    `<p>Hi,</p>
     <p>This is your monthly reminder to review pending Rate Management suggestions for
     <strong>${settings.facilityName ?? 'your facility'}</strong>.</p>
     <p><a href="${summaryUrl}">Open the Rate Management Summary</a> to review and submit changes.</p>
     <p>You can change or disable this reminder under Setup → Rate Management.</p>`,
  )

  return { sent: true }
}
