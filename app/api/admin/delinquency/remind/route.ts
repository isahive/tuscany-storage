import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { tenantIds } = await req.json()
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No tenants specified' }, { status: 400 })
    }

    await connectDB()
    const tenants = await Tenant.find({ _id: { $in: tenantIds } })
    let sent = 0

    for (const tenant of tenants) {
      await sendEmail(
        tenant.email,
        'Payment Reminder — Tuscany Village Self Storage',
        `
          <h2>Payment Reminder</h2>
          <p>Hi ${tenant.firstName},</p>
          <p>Your account has an outstanding balance of <strong>$${((tenant.balance || 0) / 100).toFixed(2)}</strong>.</p>
          <p>Please log in to your portal to make a payment as soon as possible to avoid late fees or access restrictions.</p>
          <p><a href="https://tuscanystorage.com/portal/payments">Make a Payment</a></p>
          <br/>
          <p>— Tuscany Village Self Storage<br/>(865) 426-2100</p>
        `
      ).catch(() => {})
      sent++
    }

    return NextResponse.json({ success: true, data: { sent } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
