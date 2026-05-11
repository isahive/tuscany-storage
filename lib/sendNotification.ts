import NotificationTemplate from '@/models/NotificationTemplate'
import Notification from '@/models/Notification'
import { sendEmail } from '@/lib/email'
import { sendSMS } from '@/lib/twilio'
import { replacePlaceholders } from '@/lib/templatePlaceholders'
import { getSettings } from '@/lib/getSettings'
import { formatMoney } from '@/lib/utils'
import type { ITenantDocument } from '@/models/Tenant'
import type { NotificationType } from '@/types'

interface BuildPlaceholderArgs {
  tenant: Pick<ITenantDocument, 'firstName' | 'lastName' | 'email' | 'phone' | 'gateCode'>
  unitNumber?: string
  balance?: number
  monthlyRate?: number
  paymentAmount?: number
  paymentDate?: Date
  dueDate?: Date
}

/** Build the placeholder dictionary for any template. */
export async function buildPlaceholders(args: BuildPlaceholderArgs): Promise<Record<string, string>> {
  const settings = await getSettings()
  const { tenant, unitNumber, balance, monthlyRate, paymentAmount, paymentDate, dueDate } = args
  const fmtDate = (d?: Date) => (d ? d.toLocaleDateString('en-US') : '')
  return {
    tenantName: `${tenant.firstName} ${tenant.lastName}`.trim(),
    firstName: tenant.firstName ?? '',
    lastName: tenant.lastName ?? '',
    email: tenant.email ?? '',
    phone: tenant.phone ?? '',
    gateCode: tenant.gateCode ?? '',
    unitNumber: unitNumber ?? '',
    balance: balance !== undefined ? (balance / 100).toFixed(2) : '0.00',
    monthlyRate: monthlyRate !== undefined ? (monthlyRate / 100).toFixed(2) : '0.00',
    paymentAmount: paymentAmount !== undefined ? (paymentAmount / 100).toFixed(2) : '0.00',
    paymentDate: fmtDate(paymentDate),
    dueDate: fmtDate(dueDate),
    todayDate: fmtDate(new Date()),
    facilityName: settings.facilityName ?? 'Tuscany Village Self Storage',
    facilityPhone: settings.facilityPhone ?? '',
    facilityAddress: settings.facilityAddress ?? '',
    facilityEmail: settings.facilityEmail ?? '',
    portalUrl: process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/portal`
      : '/portal',
  }
}

interface SendTemplatedArgs extends BuildPlaceholderArgs {
  templateName: string
  notificationType: NotificationType
}

/**
 * Load a NotificationTemplate by name, render with placeholders, dispatch via
 * email and SMS based on template channels + tenant opt-ins, and record a Notification.
 *
 * Silent no-op if template missing or both channels disabled — never throws.
 */
export async function sendTemplatedNotification(args: SendTemplatedArgs): Promise<void> {
  const { templateName, notificationType, tenant } = args
  try {
    const template = await NotificationTemplate.findOne({ name: templateName, active: true })
    if (!template) {
      console.warn(`[sendTemplatedNotification] Template "${templateName}" not found`)
      return
    }

    const placeholders = await buildPlaceholders(args)
    const subject = replacePlaceholders(template.emailSubject, placeholders)
    const emailBody = replacePlaceholders(template.emailContent, placeholders)
    const smsBody = replacePlaceholders(template.textContent, placeholders)

    const sentEmail = template.emailEnabled && tenant.email
    const sentSms = template.textEnabled && tenant.phone

    if (sentEmail) {
      await sendEmail(tenant.email, subject, emailBody)
    }
    if (sentSms) {
      await sendSMS(tenant.phone, smsBody)
    }

    if (sentEmail || sentSms) {
      const channel: 'email' | 'sms' | 'both' =
        sentEmail && sentSms ? 'both' : sentEmail ? 'email' : 'sms'
      await Notification.create({
        tenantId: (tenant as ITenantDocument)._id,
        type: notificationType,
        channel,
        subject,
        body: sentEmail ? emailBody : smsBody,
        status: 'sent',
        sentAt: new Date(),
      })
    }
  } catch (err) {
    console.error(`[sendTemplatedNotification] Failed for "${templateName}":`, err)
  }
}

/** Convenience: format cents for log lines. */
export { formatMoney }
