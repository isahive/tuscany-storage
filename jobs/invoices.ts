import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import Unit from '@/models/Unit'
import { getSettings } from '@/lib/getSettings'
import { sendTemplatedNotification } from '@/lib/sendNotification'
import type { ITenantDocument } from '@/models/Tenant'
import type { ILeaseDocument } from '@/models/Lease'

interface InvoiceResult {
  tenantEmail: string
  action: 'invoice_created' | 'reminder_sent' | 'already_invoiced' | 'skipped'
  amount?: number
  dueDate?: Date
}

function getBillingDateForMonth(billingDay: number, year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(billingDay, lastDay))
}

function daysBetween(a: Date, b: Date): number {
  const ms = 1000 * 60 * 60 * 24
  return Math.floor((b.getTime() - a.getTime()) / ms)
}

/**
 * Invoice generation job. Runs daily.
 * For tenants whose next billing is `billingDaysBeforeDue` days away:
 *   - Send Invoice Reminder email/SMS to everyone (info for autopay, action for manual).
 *   - Create a pending Payment record ONLY for tenants without autopay
 *     (autopay creates its own Payment when it charges).
 */
export async function runInvoiceGeneration(): Promise<InvoiceResult[]> {
  console.log('[Invoices] Starting invoice generation job...')
  await connectDB()

  const settings = await getSettings()
  const daysBefore = settings.billingDaysBeforeDue ?? 7

  const now = new Date()
  const results: InvoiceResult[] = []

  const tenants = (await Tenant.find({ status: { $in: ['active', 'delinquent'] }, role: 'tenant' })) as ITenantDocument[]
  console.log(`[Invoices] Evaluating ${tenants.length} tenants (lead time: ${daysBefore} days)`)

  for (const tenant of tenants) {
    try {
      const lease = (await Lease.findOne({ tenantId: tenant._id, status: 'active' })) as ILeaseDocument | null
      if (!lease) {
        results.push({ tenantEmail: tenant.email, action: 'skipped' })
        continue
      }

      // Compute next billing date
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      let nextBilling = getBillingDateForMonth(lease.billingDay, currentYear, currentMonth)
      if (nextBilling <= now) {
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear
        nextBilling = getBillingDateForMonth(lease.billingDay, nextYear, nextMonth)
      }

      const daysUntilBilling = daysBetween(now, nextBilling)

      if (daysUntilBilling !== daysBefore) {
        // Only fire once on the exact lead-time day
        continue
      }

      const periodStart = new Date(nextBilling)
      const periodEnd = new Date(nextBilling)
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      const existing = await Payment.findOne({
        tenantId: tenant._id,
        leaseId: lease._id,
        type: 'rent',
        periodStart: { $gte: new Date(periodStart.getFullYear(), periodStart.getMonth(), 1) },
        periodEnd: { $lte: new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0) },
        status: { $in: ['pending', 'succeeded'] },
      })

      const unit = (await Unit.findById(lease.unitId).select('unitNumber').lean()) as
        | { unitNumber?: string }
        | null

      if (!existing && !tenant.autopayEnabled) {
        // Create pending invoice for manual payers
        await Payment.create({
          tenantId: tenant._id,
          leaseId: lease._id,
          unitId: lease.unitId,
          stripePaymentIntentId: `invoice_${Date.now()}_${tenant._id}`,
          amount: lease.monthlyRate,
          currency: 'usd',
          type: 'rent',
          status: 'pending',
          periodStart,
          periodEnd,
          attemptCount: 0,
        })
        results.push({
          tenantEmail: tenant.email,
          action: 'invoice_created',
          amount: lease.monthlyRate,
          dueDate: nextBilling,
        })
      } else {
        results.push({ tenantEmail: tenant.email, action: existing ? 'already_invoiced' : 'reminder_sent' })
      }

      // Always send reminder (works for both autopay-on and autopay-off tenants)
      await sendTemplatedNotification({
        templateName: 'Invoice Reminder',
        notificationType: 'payment_reminder',
        tenant,
        unitNumber: unit?.unitNumber,
        balance: lease.monthlyRate,
        monthlyRate: lease.monthlyRate,
        dueDate: nextBilling,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[Invoices] Error for ${tenant.email}:`, msg)
    }
  }

  console.log(`[Invoices] Complete. Actions: ${results.length}`)
  return results
}
