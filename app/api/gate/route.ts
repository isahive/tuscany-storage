import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import AccessLog from '@/models/AccessLog'
import Notification from '@/models/Notification'

const updateGateCodeSchema = z.object({
  tenantId: z.string().min(1),
  newCode: z.string().min(4).max(6),
  reason: z.enum(['manual', 'lockout', 'restoration']),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateGateCodeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const tenant = await Tenant.findByIdAndUpdate(
      parsed.data.tenantId,
      { gateCode: parsed.data.newCode },
      { new: true, runValidators: true }
    )

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    // Create AccessLog
    await AccessLog.create({
      tenantId: tenant._id,
      eventType: 'code_changed',
      gateId: 'entrance',
      source: 'admin',
      notes: `Gate code updated. Reason: ${parsed.data.reason}`,
    })

    // Create Notification
    await Notification.create({
      tenantId: tenant._id,
      type: 'gate_code_changed',
      channel: 'sms',
      body: `Your gate access code has been updated. New code: ${parsed.data.newCode}. Reason: ${parsed.data.reason}.`,
      status: 'pending',
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV GATE] Code updated for ${tenant.firstName} ${tenant.lastName}: ${parsed.data.newCode} (reason: ${parsed.data.reason})`)
    }

    return NextResponse.json({
      success: true,
      data: {
        tenantId: tenant._id,
        gateCode: parsed.data.newCode,
        reason: parsed.data.reason,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
