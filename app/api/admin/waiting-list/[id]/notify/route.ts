/**
 * Notify a waiting-list entry that a matching unit is available.
 *
 * Sends an email/SMS via the "Waiting List Available" template, marks the
 * entry as 'notified', and (when a unitId is supplied) stamps which unit it
 * was about so the admin dashboard can show the link.
 *
 * If dispatch fails on both channels we still flip the status — the admin
 * triggered the action intentionally and the Notification record carries the
 * failure detail. Avoids the prior silent-success UX.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import WaitingList from '@/models/WaitingList'
import Unit from '@/models/Unit'
import { sendEmail } from '@/lib/email'
import { sendSMS } from '@/lib/twilio'

interface RouteContext {
  params: Promise<{ id: string }>
}

const bodySchema = z.object({
  unitId: z.string().optional(),
  /** Optional override for the message body. Defaults to a built-in copy
   *  using facility name + unit number. */
  message: z.string().optional(),
})

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const raw = await req.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
  }

  await connectDB()
  const entry = await WaitingList.findById(id)
  if (!entry) {
    return NextResponse.json({ success: false, error: 'Waiting list entry not found' }, { status: 404 })
  }

  let unit = null as { _id: unknown; unitNumber?: string; size?: string } | null
  if (parsed.data.unitId) {
    unit = await Unit.findById(parsed.data.unitId).select('unitNumber size').lean<typeof unit>()
  }

  const subject = unit?.unitNumber
    ? `Unit ${unit.unitNumber} is now available`
    : `A unit matching your request is now available`
  const fallbackBody =
    `Hi ${entry.name},\n\n` +
    (unit?.unitNumber
      ? `Good news — unit ${unit.unitNumber}${unit.size ? ` (${unit.size})` : ''} just opened up and matches what you asked for.`
      : `Good news — a unit that matches what you asked for just opened up.`) +
    `\n\nReply to this message or call us to claim it before someone else does.`
  const message = parsed.data.message ?? fallbackBody
  const html = `<p>${message.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`

  let emailOk = false
  let smsOk = false
  let emailError: string | undefined
  let smsError: string | undefined

  if (entry.email) {
    try {
      await sendEmail(entry.email, subject, html)
      emailOk = true
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err)
      console.error('[waiting-list notify] email failed:', emailError)
    }
  }
  if (entry.phone && entry.smsOptIn) {
    try {
      await sendSMS(entry.phone, message)
      smsOk = true
    } catch (err) {
      smsError = err instanceof Error ? err.message : String(err)
      console.error('[waiting-list notify] sms failed:', smsError)
    }
  }

  entry.status = 'notified'
  entry.notifiedAt = new Date()
  if (parsed.data.unitId) entry.notifiedUnitId = parsed.data.unitId as any
  await entry.save()

  return NextResponse.json({
    success: true,
    data: {
      entry,
      dispatch: {
        email: emailOk,
        sms: smsOk,
        emailError,
        smsError,
      },
    },
  })
}
