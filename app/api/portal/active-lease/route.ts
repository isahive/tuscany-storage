import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'

// GET /api/portal/active-lease
// Returns the tenant's active lease, including whether it has been signed.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const [lease, tenant] = await Promise.all([
      Lease.findOne({ tenantId: session.user.id, status: { $in: ['active', 'pending_moveout'] } }),
      Tenant.findById(session.user.id),
    ])

    if (!lease) {
      return NextResponse.json({ success: false, error: 'No active lease' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        leaseId: lease._id.toString(),
        unitId: lease.unitId?.toString() ?? '',
        signedAt: lease.signedAt ?? null,
        tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : '',
        gateCode: tenant?.gateCode ?? '',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
