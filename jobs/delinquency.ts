import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import { nextBalanceAfter } from '@/lib/paymentBalance'
import Notification from '@/models/Notification'
import AccessLog from '@/models/AccessLog'
import PrintBatch from '@/models/PrintBatch'
import { getSettings } from '@/lib/getSettings'
import { sendTemplatedNotification } from '@/lib/sendNotification'
import { revokeAccess, grantAccess } from '@/lib/gateController'
import { computeAuctionDate } from '@/lib/auctionDate'
import type { ITenantDocument } from '@/models/Tenant'
import type { ILeaseDocument } from '@/models/Lease'
import type { NotificationType } from '@/types'

// Fallback thresholds (used if Settings.lateLienEvents is empty)
const DEFAULT_lateFeeCents = 2500
const DEFAULT_LATE_DAY = 5
const DEFAULT_LOCKOUT_DAY = 10
const DEFAULT_LIEN_DAY = 45

type LateLienStatus = 'late' | 'locked_out' | 'pre_lien' | 'lien' | 'auction'

interface LateLienEvent {
  id: string
  status: LateLienStatus
  daysPastDue: number
  notifyEmail: boolean
  notifyText: boolean
  notifyLetter: boolean
  notificationTemplate: string
  fees: Array<{ name: string; amount: number }>
  actions: string[]
}

function daysForStatus(
  events: Array<{ status: string; daysPastDue: number }> | undefined,
  status: 'late' | 'locked_out' | 'pre_lien' | 'lien' | 'auction',
  fallback: number,
): number {
  const ev = events?.find((e) => e.status === status)
  return ev?.daysPastDue ?? fallback
}

function notificationTypeForStatus(status: LateLienStatus): NotificationType {
  if (status === 'late') return 'late_notice'
  if (status === 'locked_out') return 'lockout_notice'
  return 'custom'
}

function eventKeyFor(leaseId: unknown, eventId: string, periodStart: Date): string {
  const yyyy = periodStart.getFullYear()
  const mm = String(periodStart.getMonth() + 1).padStart(2, '0')
  return `delinquency:${String(leaseId)}:${eventId}:${yyyy}-${mm}`
}

function feeKeyFor(leaseId: unknown, eventId: string, feeName: string, periodStart: Date): string {
  const yyyy = periodStart.getFullYear()
  const mm = String(periodStart.getMonth() + 1).padStart(2, '0')
  return `latelienfee:${String(leaseId)}:${eventId}:${feeName}:${yyyy}-${mm}`
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
  const events = (settings.lateLienEvents ?? []) as LateLienEvent[]
  const lateDay = settings.lateFeeAfterDays ?? daysForStatus(events, 'late', DEFAULT_LATE_DAY)
  const fallbackLockoutDay = daysForStatus(events, 'locked_out', DEFAULT_LOCKOUT_DAY)
  const lienDay = daysForStatus(events, 'lien', DEFAULT_LIEN_DAY)
  // Auction day defaults to lien + 30 if not configured
  const auctionDay = daysForStatus(events, 'auction', lienDay + 30)
  const gateAutoLockout = settings.gateAutoLockout !== false
  // Storable parity — the auction notice gives the tenant N more days before
  // the actual auction happens. Was hardcoded to 14; now configurable.
  const auctionGraceDays = settings.auctionGracePeriodDays ?? 14

  const now = new Date()
  const results: DelinquencyResult[] = []

  // Aggregated print-batch items — every event with action `queue_print` adds
  // one item. Persisted at end of run so admins see one batch per cron tick.
  const printQueue: Array<{
    tenantId: ITenantDocument['_id']
    unitNumber: string
    documentType: string
    balance: number
  }> = []

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
      const periodStart = new Date(lastBillingDate)
      const periodEnd = new Date(lastBillingDate)
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      // Check if payment was made for the current billing period
      const periodCovered = lastPayment && lastPayment.periodStart >= new Date(lastBillingDate.getFullYear(), lastBillingDate.getMonth(), 1)

      if (periodCovered) {
        // Payment received — restore to active if currently escalated. Also
        // notify the gate controller so the tenant regains access without
        // waiting for a manual gate-code refresh.
        if (tenant.status !== 'active') {
          await Tenant.findByIdAndUpdate(tenant._id, { status: 'active' })
          if (tenant.status === 'locked_out') {
            await grantAccess(tenant, settings, 'payment_received')
          }
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

      let currentStatus = tenant.status
      // Per-tenant override: Storable lets you exempt a tenant from late
      // fees (and the cascading fees configured per event). When set, the
      // status escalation still happens but no Payment rows are written.
      const feeExempt = !!tenant.lateFeeExempt

      // LATE: mark delinquent, add late fee
      if (daysSinceBilling >= lateDay && currentStatus === 'active') {
        console.log(`[Delinquency] Day ${daysSinceBilling}: Marking ${tenant.email} as delinquent`)

        await Tenant.findByIdAndUpdate(tenant._id, { status: 'delinquent' })
        currentStatus = 'delinquent'

        if (!feeExempt) {
          // Create late fee payment record
          const lateFeeBalance = await nextBalanceAfter(Payment, tenant._id, {
            direction: 'charge',
            status: 'pending',
            amount: lateFeeCents,
          })
          await Payment.create({
            tenantId: tenant._id,
            leaseId: lease._id,
            unitId: lease.unitId,
            stripePaymentIntentId: `late_fee_${Date.now()}_${tenant._id}`,
            amount: lateFeeCents,
            currency: 'usd',
            type: 'late_fee',
            status: 'pending',
            direction: 'charge',
            balanceAfter: lateFeeBalance,
            periodStart,
            periodEnd,
            attemptCount: 0,
          })
        }

        results.push({
          tenantEmail: tenant.email,
          action: feeExempt ? 'marked_delinquent_fee_skipped_exempt' : 'marked_delinquent_late_fee_added',
          daysPastDue: daysSinceBilling,
        })
      }

      // LOCKED OUT: revoke gate access — unless the tenant is flagged
      // automaticLockoutEnabled=false (Storable per-tenant override). The
      // per-tenant `automaticLockoutDays` shifts the trigger day.
      const lockoutEnabled = tenant.automaticLockoutEnabled !== false
      const effectiveLockoutDay = tenant.automaticLockoutDays ?? fallbackLockoutDay

      if (
        lockoutEnabled
        && daysSinceBilling >= effectiveLockoutDay
        && currentStatus !== 'locked_out'
      ) {
        console.log(`[Delinquency] Day ${daysSinceBilling}: Locking out ${tenant.email}`)

        const lockedOutAt = new Date()
        await Tenant.findByIdAndUpdate(tenant._id, {
          status: 'locked_out',
          lockedOutAt,
          ...(gateAutoLockout ? { gateCode: null } : {}),
        })
        currentStatus = 'locked_out'

        // Storable "Automatic Auction Dates" — when the Locked Out rule has
        // an offset (or a pinned fixed date), stamp the lease's auction date
        // now so it surfaces on the customer's Gate Access page immediately
        // rather than waiting for the auction event to fire.
        const computedAuctionDate = computeAuctionDate(lockedOutAt, settings)
        if (computedAuctionDate && !lease.auctionDate) {
          await Lease.findByIdAndUpdate(lease._id, {
            auctionDate: computedAuctionDate,
            auctionScheduledAt: lockedOutAt,
          })
          lease.auctionDate = computedAuctionDate
          lease.auctionScheduledAt = lockedOutAt
        }

        // Hit the external gate controller (no-op when not configured).
        await revokeAccess(tenant, settings, `delinquency:${daysSinceBilling}d`)

        // Log access revocation
        await AccessLog.create({
          tenantId: tenant._id,
          unitId: lease.unitId,
          eventType: 'denied',
          gateId: 'entrance',
          source: 'system',
          notes: `Gate access revoked due to delinquency (${daysSinceBilling} days past due)`,
        })

        results.push({
          tenantEmail: tenant.email,
          action: 'locked_out_access_revoked',
          daysPastDue: daysSinceBilling,
        })
      }

      let auctionNoticeDate = lease.auctionDate
      if (daysSinceBilling >= auctionDay && !auctionNoticeDate) {
        auctionNoticeDate = new Date()
        auctionNoticeDate.setDate(auctionNoticeDate.getDate() + auctionGraceDays)

        await Lease.findByIdAndUpdate(lease._id, {
          auctionDate: auctionNoticeDate,
          auctionScheduledAt: new Date(),
        })

        console.log(`[Delinquency] Day ${daysSinceBilling}: Auction scheduled for ${tenant.email} on ${auctionNoticeDate.toLocaleDateString()}`)

        results.push({
          tenantEmail: tenant.email,
          action: 'auction_scheduled',
          daysPastDue: daysSinceBilling,
        })
      }

      // Late/Lien notifications + per-event fees + queued print. Process every
      // configured non-manual event at its own threshold so multi-rule timelines
      // (e.g. Past Due at day 5 AND day 10) all fire.
      const dueEvents = events
        .filter((event) => daysSinceBilling >= event.daysPastDue)
        .sort((a, b) => a.daysPastDue - b.daysPastDue)

      for (const event of dueEvents) {
        const willNotify =
          event.notificationTemplate.trim() !== ''
          && (event.notifyEmail || event.notifyText || event.notifyLetter)

        const eventKey = eventKeyFor(lease._id, event.id, periodStart)
        const alreadyNotified = willNotify
          ? await Notification.exists({ tenantId: tenant._id, eventKey })
          : false

        // ── Notifications ──
        if (willNotify && !alreadyNotified) {
          const templateName = event.notificationTemplate.trim()
          await sendTemplatedNotification({
            templateName,
            notificationType: notificationTypeForStatus(event.status),
            tenant,
            unitNumber: undefined,
            monthlyRate: lease.monthlyRate,
            balance: (tenant.balance ?? 0) + (event.status === 'late' ? lateFeeCents : 0),
            dueDate: event.status === 'auction' ? auctionNoticeDate : lastBillingDate,
            eventKey,
          })

          results.push({
            tenantEmail: tenant.email,
            action: `${event.status}_template_sent:${templateName}`,
            daysPastDue: daysSinceBilling,
          })
        }

        // ── Per-event fees (admin-configured under each Late/Lien row) ──
        // Skip entirely for exempt tenants; otherwise dedupe by feeKey so the
        // cron is idempotent per billing period.
        if (!feeExempt && event.fees && event.fees.length > 0) {
          for (const fee of event.fees) {
            const feeKey = feeKeyFor(lease._id, event.id, fee.name, periodStart)
            const exists = await Payment.exists({
              tenantId: tenant._id,
              stripePaymentIntentId: feeKey,
            })
            if (exists) continue

            const feeBalance = await nextBalanceAfter(Payment, tenant._id, {
              direction: 'charge',
              status: 'pending',
              amount: fee.amount,
            })
            await Payment.create({
              tenantId: tenant._id,
              leaseId: lease._id,
              unitId: lease.unitId,
              // Reuse stripePaymentIntentId as the idempotency token so the
              // unique-ish constraint catches duplicate cron runs the same day.
              stripePaymentIntentId: feeKey,
              amount: fee.amount,
              currency: 'usd',
              type: 'other',
              status: 'pending',
              direction: 'charge',
              balanceAfter: feeBalance,
              periodStart,
              periodEnd,
              attemptCount: 0,
              description: fee.name,
            })
            results.push({
              tenantEmail: tenant.email,
              action: `${event.status}_fee_added:${fee.name}`,
              daysPastDue: daysSinceBilling,
            })
          }
        }

        // ── Queue print batch ──
        if (event.actions?.includes('queue_print')) {
          const printKey = `${eventKey}:print`
          // Avoid re-queueing the same event in the same period.
          const alreadyPrinted = await PrintBatch.exists({
            'items.tenantId': tenant._id,
            'items.documentType': printKey,
          })
          if (!alreadyPrinted) {
            // Pull a representative unit number for the doc header. Single-unit
            // tenants are the common case; multi-unit tenants get the first.
            const unit = await import('@/models/Unit')
              .then((m) => m.default.findById(lease.unitId).select('unitNumber').lean<{ unitNumber?: string }>())
            printQueue.push({
              tenantId: tenant._id,
              unitNumber: unit?.unitNumber ?? '—',
              documentType: printKey,
              balance: tenant.balance ?? 0,
            })
            results.push({
              tenantEmail: tenant.email,
              action: `${event.status}_queued_for_print`,
              daysPastDue: daysSinceBilling,
            })
          }
        }
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

  // ── Persist the day's print batch (single doc) ──
  if (printQueue.length > 0) {
    await PrintBatch.create({
      items: printQueue,
      format: settings.printFormat ?? 'letter',
      status: 'created',
      createdBy: 'cron:delinquency',
    })
    console.log(`[Delinquency] Created print batch with ${printQueue.length} item(s)`)
  }

  console.log(`[Delinquency] Complete. Actions taken: ${results.length}`)
  results.forEach((r) => {
    console.log(`  - ${r.tenantEmail}: ${r.action} (${r.daysPastDue} days past due)`)
  })

  return results
}
