import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Notification from '@/models/Notification'
import Tenant from '@/models/Tenant'

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

    const notification = await Notification.create({
      tenantId: parsed.data.tenantId,
      type: parsed.data.type,
      channel: parsed.data.channel,
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: 'pending',
    })

    // Log the send in dev mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV NOTIFICATION] Sending ${parsed.data.channel} to ${tenant.firstName} ${tenant.lastName} (${tenant.email})`)
      console.log(`[DEV NOTIFICATION] Subject: ${parsed.data.subject ?? '(none)'}`)
      console.log(`[DEV NOTIFICATION] Body: ${parsed.data.body}`)

      // Mark as sent in dev mode
      notification.status = 'sent'
      notification.sentAt = new Date()
      await notification.save()
    }

    return NextResponse.json({ success: true, data: notification }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
