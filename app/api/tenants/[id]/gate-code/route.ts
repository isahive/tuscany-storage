import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { generateGateCode } from '@/lib/utils'
import Tenant from '@/models/Tenant'
import AccessLog from '@/models/AccessLog'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Tenants can only generate their own gate code
    if (session.user.role !== 'admin' && session.user.id !== id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const newCode = generateGateCode()

    const tenant = await Tenant.findByIdAndUpdate(
      id,
      { gateCode: newCode },
      { new: true, runValidators: true }
    )
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    // Create AccessLog entry for code change
    await AccessLog.create({
      tenantId: tenant._id,
      eventType: 'code_changed',
      gateId: 'unknown',
      source: session.user.role === 'admin' ? 'admin' : 'app',
      notes: 'Gate code regenerated',
    })

    // Log SMS in dev mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV SMS] New gate code for ${tenant.firstName} ${tenant.lastName}: ${newCode}`)
    }

    return NextResponse.json({
      success: true,
      data: { gateCode: newCode, tenantId: tenant._id },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
