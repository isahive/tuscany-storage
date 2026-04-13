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
    const result = await Tenant.updateMany(
      { _id: { $in: tenantIds }, status: { $ne: 'locked_out' } },
      { $set: { status: 'locked_out' } }
    )

    // Notify locked out tenants
    const tenants = await Tenant.find({ _id: { $in: tenantIds } })
    for (const tenant of tenants) {
      await sendEmail(
        tenant.email,
        'Gate Access Suspended — Tuscany Village Self Storage',
        `
          <h2>Gate Access Suspended</h2>
          <p>Hi ${tenant.firstName},</p>
          <p>Due to an outstanding balance on your account, your gate access has been suspended.</p>
          <p>Please make a payment immediately to restore access:</p>
          <p><a href="https://tuscanystorage.com/portal/payments">Make a Payment</a></p>
          <p>If you believe this is an error, please contact us at (865) 426-2100.</p>
          <br/>
          <p>— Tuscany Village Self Storage</p>
        `
      ).catch(() => {})
    }

    return NextResponse.json({ success: true, data: { locked: result.modifiedCount } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
