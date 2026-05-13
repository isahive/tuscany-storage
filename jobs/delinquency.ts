import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import Notification from '@/models/Notification'
import AccessLog from '@/models/AccessLog'
import { getSettings } from '@/lib/getSettings'
import { sendTemplatedNotification } from '@/lib/sendNotification'
import type { ITenantDocument } from '@/models/Tenant'
import type { ILeaseDocument } from '@/models/Lease'

// Fallback thresholds (used if Settings.lateLienEvents is empty)
const DEFAULT_lateFeeCents = 2500
const DEFAULT_LATE_DAY = 5
const DEFAULT_LOCKOUT_DAY = 10
const DEFAULT_PRE_LIEN_DAY = 30
const DEFAULT_LIEN_DAY = 45

function daysForStatus(
  events: Array<{ status: string; daysPastDue: number }> | undefined,
  status: 'late' | 'locked_out' | 'pre_lien' | 'lien' | 'auction',
  fallback: number,
): number {
  const ev = events?.find((e) => e.status === status)
  return ev?.daysPastDue ?? fallback
}

interface DelinquencyResult {
  tenantEmail: string
  action: string
  daysPastDue: number
}

/**
 * Calculate the most recent billing date for a given billing day.
 * If the billing day hasn't occurred yet this month, use last month's.
 */
function getLastBillingDate(billingDay: number, now: Date): Date {
  const thisMonthBilling = new Date(now.getFullYear(), now.getMonth(), Math.min(billingDay, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()))

  if (thisMonthBilling <= now) {
    return thisMonthBilling
  }

  // Use previous month
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const lastDayPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate()
  return new Date(prevYear, prevMonth, Math.min(billingDay, lastDayPrevMonth))
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.floor((b.getTime() - a.getTime()) / msPerDay)
}

export async function runDelinquency(): Promise<DelinquencyResult[]> {
  console.log('[Delinquency] Starting delinquency escalation job...')
  await connectDB()

  // Load admin-configured thresholds + fees from Settings
  const settings = await getSettings()
  const lateFeeCents = settings.lateFeeAmount ?? DEFAULT_lateFeeCents
  const events = settings.lateLienEvents as Array<{ status: string; daysPastDue: number }> | undefined
  const lateDay = settings.lateFeeAfterDays ?? daysForStatus(events, 'late', DEFAULT_LATE_DAY)
  const lockoutDay = daysForStatus(events, 'locked_out', DEFAULT_LOCKOUT_DAY)
  const preLienDay = daysForStatus(events, 'pre_lien', DEFAULT_PRE_LIEN_DAY)
  const lienDay = daysForStatus(events, 'lien', DEFAULT_LIEN_DAY)
  // Auction day defaults to lien + 30 if not configured
  const auctionDay = daysForStatus(events, 'auction', lienDay + 30)
  const gateAutoLockout = settings.gateAutoLockout !== false

  const now = new Date()
  const results: DelinquencyResult[] = []

  // Find all tenants that are active, delinquent, or locked out
  const tenants = await Tenant.find({
    status: { $in: ['active', 'delinquent', 'locked_out'] },
    role: 'tenant',
  }) as ITenantDocument[]

  console.log(`[Delinquency] Evaluating ${tenants.length} tenants`)

  for (const tenant of tenants) {
    try {
      const lease = await Lease.findOne({
        tenantId: tenant._id,
        status: 'active',
      }) as ILeaseDocument | null

      if (!lease) {
        continue
      }

      // Find last successful rent payment
      const lastPayment = await Payment.findOne({
        tenantId: tenant._id,
        leaseId: lease._id,
        type: 'rent',
        status: 'succeeded',
      }).sort({ periodStart: -1 })

      // Calculate days since billing date
      const lastBillingDate = getLastBillingDate(lease.billingDay, now)
      const daysSinceBilling = daysBetween(lastBillingDate, now)

      // Check if payment was made for the current billing period
      const periodCovered = lastPayment && lastPayment.periodStart >= new Date(lastBillingDate.getFullYear(), lastBillingDate.getMonth(), 1)

      if (periodCovered) {
        // Payment received — restore to active if currently escalated
        if (tenant.status !== 'active') {
          await Tenant.findByIdAndUpdate(tenant._id, { status: 'active' })
          console.log(`[Delinquency] Tenant ${tenant.email} restored to active (payment received)`)
          results.push({
            tenantEmail: tenant.email,
            action: 'restored_to_active',
            daysPastDue: 0,
          })
        }
        continue
      }

      // No payment for current period — apply escalation based on days past due
      if (daysSinceBilling < lateDay) {
        // Grace period: no action yet
        continue
      }

      // LATE: mark delinquent, add late fee
      if (daysSinceBilling >= lateDay && daysSinceBilling < lockoutDay && tenant.status === 'active') {
        console.log(`[Delinquency] Day ${daysSinceBilling}: Marking ${tenant.email} as delinquent`)

        await Tenant.findByIdAndUpdate(tenant._id, { status: 'delinquent' })

        // Create late fee payment record
        const periodStart = new Date(lastBillingDate)
        const periodEnd = new Date(lastBillingDate)
        periodEnd.setMonth(periodEnd.getMonth() + 1)

        await Payment.create({
          tenantId: tenant._id,
          leaseId: lease._id,
          unitId: lease.unitId,
          stripePaymentIntentId: `late_fee_${Date.now()}_${tenant._id}`,
          amount: lateFeeCents,
          currency: 'usd',
          type: 'late_fee',
          status: 'pending',
          periodStart,
          periodEnd,
          attemptCount: 0,
        })

        await sendTemplatedNotification({
          templateName: 'Late Notice',
          notificationType: 'late_notice',
          tenant,
          unitNumber: undefined,
          monthlyRate: lease.monthlyRate,
          balance: (tenant.balance ?? 0) + lateFeeCents,
          dueDate: lastBillingDate,
        })

        results.push({
          tenantEmail: tenant.email,
          action: 'marked_delinquent_late_fee_added',
          daysPastDue: daysSinceBilling,
        })
      }

      // LOCKED OUT: revoke gate access
      if (daysSinceBilling >= lockoutDay && daysSinceBilling < preLienDay && tenant.status === 'delinquent') {
        console.log(`[Delinquency] Day ${daysSinceBilling}: Locking out ${tenant.email}`)

        await Tenant.findByIdAndUpdate(tenant._id, {
          status: 'locked_out',
          ...(gateAutoLockout ? { gateCode: null } : {}),
        })

        // Log access revocation
        await AccessLog.create({
          tenantId: tenant._id,
          unitId: lease.unitId,
          eventType: 'denied',
          gateId: 'entrance',
          source: 'system',
          notes: `Gate access revoked due to delinquency (${daysSinceBilling} days past due)`,
        })

        await sendTemplatedNotification({
          templateName: 'Lockout Notice',
          notificationType: 'lockout_notice',
          tenant,
          monthlyRate: lease.monthlyRate,
          balance: (tenant.balance ?? 0) + lateFeeCents,
          dueDate: lastBillingDate,
        })

        results.push({
          tenantEmail: tenant.email,
          action: 'locked_out_access_revoked',
          daysPastDue: daysSinceBilling,
        })
      }

      // Pre-lien notice
      if (daysSinceBilling >= preLienDay && daysSinceBilling < lienDay) {
        // Check if pre-lien notice already sent
        const existingPreLien = await Notification.findOne({
          tenantId: tenant._id,
          type: 'custom',
          subject: /pre-lien/i,
          createdAt: { $gte: lastBillingDate },
        })

        if (!existingPreLien) {
          await sendTemplatedNotification({
            templateName: 'Pre-Lien Notice',
            notificationType: 'custom',
            tenant,
            monthlyRate: lease.monthlyRate,
            balance: tenant.balance ?? 0,
          })

          results.push({
            tenantEmail: tenant.email,
            action: 'pre_lien_notice_sent',
            daysPastDue: daysSinceBilling,
          })
        }
      }

      // Lien notice
      if (daysSinceBilling >= lienDay) {
        const existingLien = await Notification.findOne({
          tenantId: tenant._id,
          type: 'custom',
          subject: /^Lien Notice/,
          createdAt: { $gte: lastBillingDate },
        })

        if (!existingLien) {
          await sendTemplatedNotification({
            templateName: 'Lien Notice',
            notificationType: 'custom',
            tenant,
            monthlyRate: lease.monthlyRate,
            balance: tenant.balance ?? 0,
          })

          results.push({
            tenantEmail: tenant.email,
            action: 'lien_notice_sent',
            daysPastDue: daysSinceBilling,
          })
        }
      }

      // Auction scheduling — schedule auction date 14 days out when threshold hit
      if (daysSinceBilling >= auctionDay && !lease.auctionDate) {
        const auctionDate = new Date()
        auctionDate.setDate(auctionDate.getDate() + 14)

        await Lease.findByIdAndUpdate(lease._id, {
          auctionDate,
          auctionScheduledAt: new Date(),
        })

        console.log(`[Delinquency] Day ${daysSinceBilling}: Auction scheduled for ${tenant.email} on ${auctionDate.toLocaleDateString()}`)

        await sendTemplatedNotification({
          templateName: 'Auction Notice',
          notificationType: 'custom',
          tenant,
          monthlyRate: lease.monthlyRate,
          balance: tenant.balance ?? 0,
          dueDate: auctionDate,
        })

        results.push({
          tenantEmail: tenant.email,
          action: 'auction_scheduled',
          daysPastDue: daysSinceBilling,
        })
      }
    } catch (err: any) {
      console.error(`[Delinquency] Error processing tenant ${tenant.email}:`, err.message)
      results.push({
        tenantEmail: tenant.email,
        action: `error: ${err.message}`,
        daysPastDue: -1,
      })
    }
  }

  console.log(`[Delinquency] Complete. Actions taken: ${results.length}`)
  results.forEach((r) => {
    console.log(`  - ${r.tenantEmail}: ${r.action} (${r.daysPastDue} days past due)`)
  })

  return results
}
