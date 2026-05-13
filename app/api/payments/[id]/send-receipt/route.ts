import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Payment from '@/models/Payment'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import { sendTemplatedNotification } from '@/lib/sendNotification'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/payments/[id]/send-receipt
 * Admin-only. Emails (and optionally SMSs) a payment receipt to the tenant
 * using the "Manually Sent Payment Receipt" template.
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const payment = await Payment.findById(id).lean() as any
    if (!payment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 })
    }

    const [tenant, unit] = await Promise.all([
      Tenant.findById(payment.tenantId),
      payment.unitId ? Unit.findById(payment.unitId).lean() : null,
    ])
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    await sendTemplatedNotification({
      templateName: 'Manually Sent Payment Receipt',
      notificationType: 'payment_confirmation',
      tenant: tenant as any,
      unitNumber: (unit as any)?.unitNumber,
      unitSize: (unit as any)?.size,
      paymentAmount: payment.amount,
      paymentDate: payment.createdAt,
      balance: tenant.balance ?? 0,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
