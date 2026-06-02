/**
 * Admin-initiated custom notification.
 *
 * Previously this route created a Notification record with status='pending'
 * and never dispatched the message — admins saw a "Success" toast while
 * tenants received nothing. The route now actually calls sendEmail/sendSMS
 * and mirrors the per-channel outcome into Notification.status so the failure
 * mode is visible.
 *
 * In dev (no Twilio/Resend keys) the dispatch fns log + return null and we
 * mark the notification as 'sent' — the dev log is the "send". In prod a
 * missing key throws and we record 'failed' with the error.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Notification from '@/models/Notification'
import Tenant from '@/models/Tenant'
import { sendEmail } from '@/lib/email'
import { sendSMS } from '@/lib/twilio'
import { getSettings } from '@/lib/getSettings'
import { wrapTenantEmail } from '@/lib/emailLayout'

const sendNotificationSchema = z.object({
  tenantId: z.string().min(1),
  type: z.literal('custom'),
  channel: z.enum(['email', 'sms', 'both']),
  subject: z.string().optional(),
  body: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = sendNotificationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const tenant = await Tenant.findById(parsed.data.tenantId)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const wantEmail = parsed.data.channel === 'email' || parsed.data.channel === 'both'
    const wantSms = parsed.data.channel === 'sms' || parsed.data.channel === 'both'

    let emailOk = false
    let smsOk = false
    let emailError: string | undefined
    let smsError: string | undefined
    let resendMessageId: string | null = null
    let twilioMessageSid: string | null = null

    if (wantEmail && tenant.email) {
      try {
        const settings = await getSettings()
        const html = `<p>${parsed.data.body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`
        const wrapped = wrapTenantEmail(html, settings)
        resendMessageId = await sendEmail(
          tenant.email,
          parsed.data.subject ?? 'A message from Tuscany Storage',
          wrapped,
        )
        emailOk = true
      } catch (err) {
        emailError = err instanceof Error ? err.message : String(err)
        console.error('[notifications] email failed:', emailError)
      }
    }
    if (wantSms && tenant.phone) {
      try {
        twilioMessageSid = await sendSMS(tenant.phone, parsed.data.body)
        smsOk = true
      } catch (err) {
        smsError = err instanceof Error ? err.message : String(err)
        console.error('[notifications] sms failed:', smsError)
      }
    }

    const anyOk = emailOk || smsOk
    const failureReason = anyOk
      ? undefined
      : [emailError, smsError].filter(Boolean).join('; ') || 'no channel dispatched'

    const notification = await Notification.create({
      tenantId: parsed.data.tenantId,
      type: parsed.data.type,
      channel: parsed.data.channel,
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: anyOk ? 'sent' : 'failed',
      sentAt: anyOk ? new Date() : undefined,
      ...(failureReason ? { failureReason } : {}),
      ...(resendMessageId ? { resendMessageId } : {}),
      ...(twilioMessageSid ? { twilioMessageSid } : {}),
    })

    return NextResponse.json({ success: true, data: notification }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
