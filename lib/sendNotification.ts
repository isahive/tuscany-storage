import NotificationTemplate from '@/models/NotificationTemplate'
import Notification from '@/models/Notification'
import { sendEmail } from '@/lib/email'
import { sendSMS } from '@/lib/twilio'
import { replacePlaceholders } from '@/lib/templatePlaceholders'
import { getSettings } from '@/lib/getSettings'
import { formatMoney } from '@/lib/utils'
import { DEFAULT_TEMPLATES } from '@/lib/defaultTemplates'
import type { ITenantDocument } from '@/models/Tenant'
import type { NotificationType } from '@/types'

interface BuildPlaceholderArgs {
  tenant: Pick<ITenantDocument,
    'firstName' | 'lastName' | 'email' | 'phone' | 'gateCode'
    | 'address' | 'city' | 'state' | 'zip'
    | 'alternateContactName' | 'alternatePhone' | 'alternateEmail'
    | 'alternateAddress' | 'alternateCity' | 'alternateState' | 'alternateZip'
    | 'username'
  > & { balance?: number }
  unitNumber?: string
  unitSize?: string
  balance?: number
  monthlyRate?: number
  deposit?: number
  paymentAmount?: number
  paymentDate?: Date
  dueDate?: Date
}

/**
 * Build the placeholder dictionary for any template.
 *
 * The editor surfaces [[ALL_CAPS]] tokens (matches the live Storable admin) but
 * older templates may still use [[camelCase]] keys. We populate both so neither
 * format breaks.
 */
export async function buildPlaceholders(args: BuildPlaceholderArgs): Promise<Record<string, string>> {
  const settings = await getSettings()
  const {
    tenant, unitNumber, unitSize, balance, monthlyRate, deposit,
    paymentAmount, paymentDate, dueDate,
  } = args

  const money = (cents?: number) =>
    cents !== undefined
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
      : '$0.00'
  const fmtDate = (d?: Date) => (d ? d.toLocaleDateString('en-US') : '')

  const fullName = `${tenant.firstName ?? ''} ${tenant.lastName ?? ''}`.trim()
  const customerAddress = [tenant.address, tenant.city, tenant.state, tenant.zip].filter(Boolean).join(', ')
  const alternateAddress = [tenant.alternateAddress, tenant.alternateCity, tenant.alternateState, tenant.alternateZip]
    .filter(Boolean).join(', ')
  const facilityAddress = [settings.facilityAddress, settings.facilityCity, settings.facilityState, settings.facilityZip]
    .filter(Boolean).join(', ')
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/portal`
    : '/portal'
  const facilityUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const today = fmtDate(new Date())

  return {
    // ── [[ALL_CAPS]] tokens — what the editor's Insert Placeholder dropdown
    //    surfaces. These are the canonical names; keep them in sync with the
    //    PLACEHOLDER_GROUPS list in the templates editor.
    CUSTOMER_NAME:        fullName,
    CUSTOMER_USERNAME:    tenant.username ?? tenant.email ?? '',
    CUSTOMER_EMAIL:       tenant.email ?? '',
    EMAIL_ADDRESS:        tenant.email ?? '',
    CUSTOMER_PHONE:       tenant.phone ?? '',
    CUSTOMER_PHONE_NUMBER: tenant.phone ?? '',
    CUSTOMER_ADDRESS:     customerAddress,
    CUSTOMER_ACCESS_CODE: tenant.gateCode ?? '',
    GATE_CODE:            tenant.gateCode ?? '',
    UNIT:                 unitNumber ?? '',
    UNIT_NUMBER:          unitNumber ?? '',
    UNIT_SIZE:            unitSize ?? '',
    RENT:                 money(monthlyRate),
    MONTHLY_RATE:         money(monthlyRate),
    DEPOSIT:              money(deposit),
    BALANCE:              money(balance ?? tenant.balance),
    DUE_DATE:             fmtDate(dueDate),
    DATE:                 today,
    TODAY:                today,
    PAYMENT_AMOUNT:       money(paymentAmount),
    PAYMENT_DATE:         fmtDate(paymentDate),
    FACILITY_NAME:        settings.facilityName ?? 'Tuscany Village Self Storage',
    FACILITY_PHONE:       settings.facilityPhone ?? '',
    FACILITY_EMAIL:       settings.facilityEmail ?? '',
    FACILITY_ADDRESS:     facilityAddress,
    FACILITY_URL:         facilityUrl,
    PORTAL_URL:           portalUrl,
    ALTERNATE_CONTACT:    tenant.alternateContactName ?? '',
    ALTERNATE_PHONE_NUMBER: tenant.alternatePhone ?? '',
    ALTERNATE_EMAIL:      tenant.alternateEmail ?? '',
    ALTERNATE_ADDRESS:    alternateAddress,

    // ── camelCase aliases — back-compat with templates seeded before the
    //    editor switched to ALL_CAPS.
    tenantName:      fullName,
    firstName:       tenant.firstName ?? '',
    lastName:        tenant.lastName ?? '',
    email:           tenant.email ?? '',
    phone:           tenant.phone ?? '',
    gateCode:        tenant.gateCode ?? '',
    unitNumber:      unitNumber ?? '',
    balance:         balance !== undefined ? (balance / 100).toFixed(2) : '0.00',
    monthlyRate:     monthlyRate !== undefined ? (monthlyRate / 100).toFixed(2) : '0.00',
    paymentAmount:   paymentAmount !== undefined ? (paymentAmount / 100).toFixed(2) : '0.00',
    paymentDate:     fmtDate(paymentDate),
    dueDate:         fmtDate(dueDate),
    todayDate:       today,
    facilityName:    settings.facilityName ?? 'Tuscany Village Self Storage',
    facilityPhone:   settings.facilityPhone ?? '',
    facilityAddress: facilityAddress,
    facilityEmail:   settings.facilityEmail ?? '',
    portalUrl,
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
    // 1) Prefer the live DB template (admin may have customised it).
    // 2) Fall back to DEFAULT_TEMPLATES so cron jobs aren't gated on someone
    //    first opening the templates page to trigger the seed.
    const dbTemplate = await NotificationTemplate.findOne({ name: templateName, active: true }).lean()
    const fallback = DEFAULT_TEMPLATES.find((t) => t.name === templateName)
    const template = dbTemplate ?? fallback

    if (!template) {
      console.warn(`[sendTemplatedNotification] Template "${templateName}" not found in DB or defaults`)
      return
    }

    const placeholders = await buildPlaceholders(args)
    const subject = replacePlaceholders(template.emailSubject ?? '', placeholders)
    const emailBody = replacePlaceholders(template.emailContent ?? '', placeholders)
    const smsBody = replacePlaceholders(template.textContent ?? '', placeholders)

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
