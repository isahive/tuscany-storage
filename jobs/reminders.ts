import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Notification from '@/models/Notification'
import { sendSMS } from '@/lib/twilio'
import { sendEmail } from '@/lib/sendgrid'
import { formatMoney } from '@/lib/utils'
import type { ILeaseDocument } from '@/models/Lease'
import type { ITenantDocument } from '@/models/Tenant'

export async function runReminders(): Promise<void> {
  console.log('[Reminders] Starting D-3 payment reminder job...')
  await connectDB()

  const now = new Date()
  const threeDaysFromNow = new Date(now)
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

  const targetDay = threeDaysFromNow.getDate()

  // Find all active leases where billingDay matches 3 days from now
  const leases = await Lease.find({
    status: 'active',
    billingDay: targetDay,
  }) as ILeaseDocument[]

  console.log(`[Reminders] Found ${leases.length} leases with billing day ${targetDay} (3 days from now)`)

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const lease of leases) {
    try {
      const tenant = await Tenant.findById(lease.tenantId) as ITenantDocument | null

      if (!tenant) {
        console.log(`[Reminders] Tenant not found for lease ${lease._id}, skipping`)
        skipped++
        continue
      }

      if (tenant.status === 'moved_out') {
        console.log(`[Reminders] Tenant ${tenant.email} is moved out, skipping`)
        skipped++
        continue
      }

      // Check if we already sent a reminder for this billing cycle
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const existingReminder = await Notification.findOne({
        tenantId: tenant._id,
        type: 'payment_reminder',
        createdAt: { $gte: startOfMonth },
      })

      if (existingReminder) {
        console.log(`[Reminders] Reminder already sent to ${tenant.email} this month, skipping`)
        skipped++
        continue
      }

      const amountFormatted = formatMoney(lease.monthlyRate)
      const dueDate = new Date(
        threeDaysFromNow.getFullYear(),
        threeDaysFromNow.getMonth(),
        targetDay
      )
      const dueDateStr = dueDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })

      const smsBody = `Tuscany Village Storage: Your rent payment of ${amountFormatted} is due on ${dueDateStr}. Log in to your portal to pay or set up autopay.`

      const emailSubject = `Payment Reminder - ${amountFormatted} due ${dueDateStr}`
      const emailBody = `
        <h2>Payment Reminder</h2>
        <p>Hi ${tenant.firstName},</p>
        <p>This is a friendly reminder that your storage unit rent payment of <strong>${amountFormatted}</strong> is due on <strong>${dueDateStr}</strong>.</p>
        <p>You can pay online through your tenant portal or set up autopay for hassle-free monthly payments.</p>
        <p>If you've already made your payment, please disregard this notice.</p>
        <br/>
        <p>Thank you,<br/>Tuscany Village Self Storage</p>
      `

      // Determine channel
      const channel = tenant.smsOptIn ? 'both' : 'email'

      // Send SMS if opted in
      if (tenant.smsOptIn) {
        await sendSMS(tenant.phone, smsBody)
      }

      // Send email
      await sendEmail(tenant.email, emailSubject, emailBody)

      // Create notification record
      await Notification.create({
        tenantId: tenant._id,
        type: 'payment_reminder',
        channel,
        subject: emailSubject,
        body: smsBody,
        status: 'sent',
        sentAt: new Date(),
      })

      console.log(`[Reminders] Reminder sent to ${tenant.email} (${channel})`)
      sent++
    } catch (err: any) {
      console.error(`[Reminders] Error sending reminder for lease ${lease._id}:`, err.message)
      errors++
    }
  }

  console.log(`[Reminders] Complete. Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`)
}
