import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import Notification from '@/models/Notification'
import AccessLog from '@/models/AccessLog'
import { sendSMS } from '@/lib/twilio'
import { sendEmail } from '@/lib/email'
import { formatMoney } from '@/lib/utils'
import type { ITenantDocument } from '@/models/Tenant'
import type { ILeaseDocument } from '@/models/Lease'

const LATE_FEE_CENTS = 2500 // $25.00

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
      if (daysSinceBilling < 5) {
        // Day 0-4: No action yet
        continue
      }

      const amountFormatted = formatMoney(lease.monthlyRate)

      // Day 5 — LATE: mark delinquent, add late fee
      if (daysSinceBilling >= 5 && daysSinceBilling < 10 && tenant.status === 'active') {
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
          amount: LATE_FEE_CENTS,
          currency: 'usd',
          type: 'late_fee',
          status: 'pending',
          periodStart,
          periodEnd,
          attemptCount: 0,
        })

        // Send notifications
        const emailSubject = 'Late Payment Notice - Tuscany Village Self Storage'
        const emailBody = `
          <h2>Late Payment Notice</h2>
          <p>Hi ${tenant.firstName},</p>
          <p>Your rent payment of <strong>${amountFormatted}</strong> was due on ${lastBillingDate.toLocaleDateString('en-US')} and has not been received.</p>
          <p>A late fee of <strong>${formatMoney(LATE_FEE_CENTS)}</strong> has been applied to your account.</p>
          <p>Please make your payment as soon as possible to avoid further action.</p>
          <br/>
          <p>Tuscany Village Self Storage</p>
        `
        const smsBody = `Tuscany Village Storage: Your payment of ${amountFormatted} is past due. A $25.00 late fee has been applied. Please pay immediately to avoid further action.`

        await sendEmail(tenant.email, emailSubject, emailBody)
        if (tenant.smsOptIn) {
          await sendSMS(tenant.phone, smsBody)
        }

        await Notification.create({
          tenantId: tenant._id,
          type: 'late_notice',
          channel: tenant.smsOptIn ? 'both' : 'email',
          subject: emailSubject,
          body: smsBody,
          status: 'sent',
          sentAt: new Date(),
        })

        results.push({
          tenantEmail: tenant.email,
          action: 'marked_delinquent_late_fee_added',
          daysPastDue: daysSinceBilling,
        })
      }

      // Day 10 — LOCKED OUT: revoke gate access
      if (daysSinceBilling >= 10 && daysSinceBilling < 30 && tenant.status === 'delinquent') {
        console.log(`[Delinquency] Day ${daysSinceBilling}: Locking out ${tenant.email}`)

        await Tenant.findByIdAndUpdate(tenant._id, {
          status: 'locked_out',
          gateCode: null, // Revoke gate access
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

        const emailSubject = 'Access Suspended - Tuscany Village Self Storage'
        const emailBody = `
          <h2>Access Suspended</h2>
          <p>Hi ${tenant.firstName},</p>
          <p>Due to non-payment, your gate access to Tuscany Village Self Storage has been <strong>suspended</strong>.</p>
          <p>Your outstanding balance of <strong>${amountFormatted}</strong> plus a late fee of <strong>${formatMoney(LATE_FEE_CENTS)}</strong> must be paid to restore access.</p>
          <p>Please contact us immediately to resolve this matter.</p>
          <br/>
          <p>Tuscany Village Self Storage</p>
        `
        const smsBody = `Tuscany Village Storage: Your gate access has been SUSPENDED due to non-payment. Contact us immediately to resolve. Outstanding: ${amountFormatted} + $25 late fee.`

        await sendEmail(tenant.email, emailSubject, emailBody)
        if (tenant.smsOptIn) {
          await sendSMS(tenant.phone, smsBody)
        }

        await Notification.create({
          tenantId: tenant._id,
          type: 'lockout_notice',
          channel: tenant.smsOptIn ? 'both' : 'email',
          subject: emailSubject,
          body: smsBody,
          status: 'sent',
          sentAt: new Date(),
        })

        results.push({
          tenantEmail: tenant.email,
          action: 'locked_out_access_revoked',
          daysPastDue: daysSinceBilling,
        })
      }

      // Day 30 — Pre-lien notice
      if (daysSinceBilling >= 30 && daysSinceBilling < 45) {
        // Check if pre-lien notice already sent
        const existingPreLien = await Notification.findOne({
          tenantId: tenant._id,
          type: 'custom',
          subject: /pre-lien/i,
          createdAt: { $gte: lastBillingDate },
        })

        if (!existingPreLien) {
          console.log(`[Delinquency] Day ${daysSinceBilling}: Sending pre-lien notice to ${tenant.email}`)

          const emailSubject = 'Pre-Lien Notice - Tuscany Village Self Storage'
          const emailBody = `
            <h2>Pre-Lien Notice</h2>
            <p>Hi ${tenant.firstName},</p>
            <p>This is a formal pre-lien notice regarding your storage unit at Tuscany Village Self Storage.</p>
            <p>Your account is <strong>${daysSinceBilling} days past due</strong> with an outstanding balance.</p>
            <p>If payment is not received within 15 days, a lien will be placed on your stored property in accordance with state law.</p>
            <p>Please contact us immediately to make arrangements.</p>
            <br/>
            <p>Tuscany Village Self Storage</p>
          `
          const smsBody = `IMPORTANT: Pre-lien notice for your Tuscany Village storage unit. Your account is ${daysSinceBilling} days past due. Contact us immediately to avoid a lien on your property.`

          await sendEmail(tenant.email, emailSubject, emailBody)
          if (tenant.smsOptIn) {
            await sendSMS(tenant.phone, smsBody)
          }

          await Notification.create({
            tenantId: tenant._id,
            type: 'custom',
            channel: tenant.smsOptIn ? 'both' : 'email',
            subject: emailSubject,
            body: smsBody,
            status: 'sent',
            sentAt: new Date(),
          })

          results.push({
            tenantEmail: tenant.email,
            action: 'pre_lien_notice_sent',
            daysPastDue: daysSinceBilling,
          })
        }
      }

      // Day 45 — Lien notice
      if (daysSinceBilling >= 45) {
        const existingLien = await Notification.findOne({
          tenantId: tenant._id,
          type: 'custom',
          subject: /^Lien Notice/,
          createdAt: { $gte: lastBillingDate },
        })

        if (!existingLien) {
          console.log(`[Delinquency] Day ${daysSinceBilling}: Sending lien notice to ${tenant.email}`)

          const emailSubject = 'Lien Notice - Tuscany Village Self Storage'
          const emailBody = `
            <h2>Lien Notice</h2>
            <p>Hi ${tenant.firstName},</p>
            <p>This is a formal lien notice regarding your storage unit at Tuscany Village Self Storage.</p>
            <p>Your account is <strong>${daysSinceBilling} days past due</strong>. A lien has been placed on your stored property.</p>
            <p>Your property may be sold at public auction if the outstanding balance is not paid in full.</p>
            <p>Contact us immediately to resolve this matter.</p>
            <br/>
            <p>Tuscany Village Self Storage</p>
          `
          const smsBody = `URGENT: A lien has been placed on your property at Tuscany Village Storage. Your account is ${daysSinceBilling} days past due. Contact us immediately.`

          await sendEmail(tenant.email, emailSubject, emailBody)
          if (tenant.smsOptIn) {
            await sendSMS(tenant.phone, smsBody)
          }

          await Notification.create({
            tenantId: tenant._id,
            type: 'custom',
            channel: tenant.smsOptIn ? 'both' : 'email',
            subject: emailSubject,
            body: smsBody,
            status: 'sent',
            sentAt: new Date(),
          })

          results.push({
            tenantEmail: tenant.email,
            action: 'lien_notice_sent',
            daysPastDue: daysSinceBilling,
          })
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

  console.log(`[Delinquency] Complete. Actions taken: ${results.length}`)
  results.forEach((r) => {
    console.log(`  - ${r.tenantEmail}: ${r.action} (${r.daysPastDue} days past due)`)
  })

  return results
}
