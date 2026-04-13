import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import AccessLog from '@/models/AccessLog'

// GET /api/portal/dashboard
// Returns everything the portal dashboard page needs in a single call.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Ensure Unit model is registered before populate
    void Unit

    const [tenant, lease, accessLogs] = await Promise.all([
      Tenant.findById(session.user.id),
      Lease.findOne({ tenantId: session.user.id, status: { $in: ['active', 'pending_moveout'] } }).populate('unitId'),
      AccessLog.find({ tenantId: session.user.id }).sort({ createdAt: -1 }).limit(10),
    ])

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    if (!lease) {
      return NextResponse.json({
        success: true,
        data: {
          tenant: { firstName: tenant.firstName, balance: 0 },
          unit: null,
          lease: null,
          accessLogs: accessLogs.map((log) => ({
            _id: log._id.toString(),
            eventType: log.eventType,
            gateId: log.gateId,
            source: log.source,
            createdAt: log.createdAt.toISOString(),
          })),
        },
      })
    }

    // Calculate next payment date from billingDay
    const now = new Date()
    const billingDay = lease.billingDay ?? 1
    let nextPaymentDate = new Date(now.getFullYear(), now.getMonth(), billingDay)
    if (nextPaymentDate <= now) {
      nextPaymentDate = new Date(now.getFullYear(), now.getMonth() + 1, billingDay)
    }

    const daysUntilDue = Math.ceil(
      (nextPaymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    const unit = lease.unitId as any

    return NextResponse.json({
      success: true,
      data: {
        tenant: {
          firstName: tenant.firstName,
          balance: 0,
        },
        unit: unit
          ? {
              unitNumber: unit.unitNumber,
              size: unit.size,
              type: unit.type,
              floor: unit.floor,
              features: unit.features ?? [],
              monthlyRate: lease.monthlyRate,
            }
          : null,
        lease: {
          startDate: lease.startDate.toISOString(),
          billingDay: lease.billingDay,
          autopayEnabled: tenant.autopayEnabled ?? false,
          nextPaymentAmount: lease.monthlyRate,
          nextPaymentDate: nextPaymentDate.toISOString(),
          daysUntilDue,
        },
        accessLogs: accessLogs.map((log) => ({
          _id: log._id.toString(),
          eventType: log.eventType,
          gateId: log.gateId,
          source: log.source,
          createdAt: log.createdAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
