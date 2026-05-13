import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Notification from '@/models/Notification'
import { sendTemplatedNotification } from '@/lib/sendNotification'
import type { ILeaseDocument } from '@/models/Lease'
import type { ITenantDocument } from '@/models/Tenant'

/**
 * D-3 payment reminders. Picks leases whose billingDay is 3 days from now and
 * sends each tenant the "Invoice Reminder" template (placeholders resolved from
 * tenant + unit + settings). Admin-edited template content takes effect here.
 */
export async function runReminders(): Promise<void> {
  console.log('[Reminders] Starting D-3 payment reminder job...')
  await connectDB()

  const now = new Date()
  const threeDaysFromNow = new Date(now)
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

  const targetDay = threeDaysFromNow.getDate()

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
      if (!tenant) { skipped++; continue }
      if (tenant.status === 'moved_out') { skipped++; continue }

      // Skip if a reminder for this billing cycle already went out.
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const existing = await Notification.findOne({
        tenantId: tenant._id,
        type: 'payment_reminder',
        createdAt: { $gte: startOfMonth },
      })
      if (existing) { skipped++; continue }

      const unit = await Unit.findById(lease.unitId).lean()
      const dueDate = new Date(threeDaysFromNow.getFullYear(), threeDaysFromNow.getMonth(), targetDay)

      await sendTemplatedNotification({
        templateName: 'Invoice Reminder',
        notificationType: 'payment_reminder',
        tenant,
        unitNumber: (unit as any)?.unitNumber,
        unitSize: (unit as any)?.size,
        monthlyRate: lease.monthlyRate,
        balance: tenant.balance ?? lease.monthlyRate,
        dueDate,
      })

      sent++
    } catch (err: any) {
      console.error(`[Reminders] Error for lease ${lease._id}:`, err.message)
      errors++
    }
  }

  console.log(`[Reminders] Complete. Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`)
}
