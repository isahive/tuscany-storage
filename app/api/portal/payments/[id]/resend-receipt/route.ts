import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Payment from '@/models/Payment'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Notification from '@/models/Notification'
import { sendTemplatedNotification } from '@/lib/sendNotification'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Abuse controls — a self-service resend dispatches email/SMS (which costs
// money and lands in someone's inbox/phone), so cap it per tenant.
const RESEND_LIMIT = 2 // max resends…
const WINDOW_MS = 60 * 60 * 1000 // …per rolling hour
const SELF_RESEND_KEY = 'self-resend-receipt'

/**
 * POST /api/portal/payments/[id]/resend-receipt
 * Tenant-facing. Resends the payment receipt for one of the signed-in
 * tenant's OWN payments, by email or text. Rate limited.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const tenantId = session.user.id

    const { id } = await context.params

    // Channel is optional; default honors the template's own flags.
    let channel: 'email' | 'sms' | undefined
    try {
      const body = await req.json()
      if (body?.channel === 'email' || body?.channel === 'sms') channel = body.channel
    } catch {
      // no/invalid body → both channels
    }

    await connectDB()

    // ── Access control (OWASP A01 / IDOR): the payment MUST belong to the
    // signed-in tenant. A uniform 404 avoids leaking whether another tenant's
    // payment id exists.
    const payment = (await Payment.findById(id).lean()) as any
    if (!payment || String(payment.tenantId) !== tenantId) {
      return NextResponse.json({ success: false, error: 'Receipt not found' }, { status: 404 })
    }
    if (payment.direction !== 'payment' || payment.status !== 'succeeded') {
      return NextResponse.json(
        { success: false, error: 'Receipts are only available for completed payments.' },
        { status: 400 },
      )
    }

    // ── Rate limit (OWASP A04 / unrestricted resource consumption). DB-backed
    // so the cap holds across serverless instances rather than per-process.
    const since = new Date(Date.now() - WINDOW_MS)
    const recent = await Notification.countDocuments({
      tenantId,
      eventKey: SELF_RESEND_KEY,
      createdAt: { $gte: since },
    })
    if (recent >= RESEND_LIMIT) {
      return NextResponse.json(
        { success: false, error: `You can resend up to ${RESEND_LIMIT} receipts per hour. Please try again later.` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(WINDOW_MS / 1000)) } },
      )
    }

    const tenant = await Tenant.findById(tenantId)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 })
    }

    // Channel must have a usable destination, or the send is a silent no-op.
    if (channel === 'sms' && !(tenant.smsOptIn && tenant.phone)) {
      return NextResponse.json(
        { success: false, error: 'No phone number on file or text messages are not enabled for your account.' },
        { status: 400 },
      )
    }
    if (channel === 'email' && !tenant.email) {
      return NextResponse.json({ success: false, error: 'No email address on file.' }, { status: 400 })
    }

    const unit = payment.unitId ? ((await Unit.findById(payment.unitId).lean()) as any) : null

    await sendTemplatedNotification({
      templateName: 'Manually Sent Payment Receipt',
      notificationType: 'payment_confirmation',
      tenant: tenant as any,
      unitNumber: unit?.unitNumber,
      unitSize: unit?.size,
      paymentAmount: payment.amount,
      paymentDate: payment.createdAt,
      balance: tenant.balance ?? 0,
      channels: channel,
      // Tags the Notification so the rate-limit counter only sees tenant
      // self-service resends (not admin or automated sends).
      eventKey: SELF_RESEND_KEY,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
