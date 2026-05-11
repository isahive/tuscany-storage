import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import ProtectionPlan from '@/models/ProtectionPlan'

// GET /api/portal/protection-plan
// Returns the tenant's current plan (from active lease) + all available plans.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const lease = await Lease.findOne({
      tenantId: session.user.id,
      status: { $in: ['active', 'pending_moveout'] },
    })

    if (!lease) {
      return NextResponse.json({ success: false, error: 'No active lease' }, { status: 404 })
    }

    const [current, all] = await Promise.all([
      lease.protectionPlanId ? ProtectionPlan.findById(lease.protectionPlanId).lean() : null,
      ProtectionPlan.find({ status: 'active' }).sort({ displayOrder: 1, monthlyPrice: 1 }).lean(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        leaseId: lease._id.toString(),
        currentPlanId: lease.protectionPlanId?.toString() ?? null,
        currentPlan: current
          ? {
              _id: current._id.toString(),
              name: current.name,
              coverageAmount: current.coverageAmount,
              monthlyPrice: current.monthlyPrice,
              description: current.description,
            }
          : null,
        availablePlans: all.map((p) => ({
          _id: p._id.toString(),
          name: p.name,
          coverageAmount: p.coverageAmount,
          monthlyPrice: p.monthlyPrice,
          description: p.description,
        })),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// PUT /api/portal/protection-plan
// Body: { planId: string | null }  (null = remove protection)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const planId: string | null = body?.planId ?? null

    await connectDB()

    const lease = await Lease.findOne({
      tenantId: session.user.id,
      status: { $in: ['active', 'pending_moveout'] },
    })

    if (!lease) {
      return NextResponse.json({ success: false, error: 'No active lease' }, { status: 404 })
    }

    if (planId) {
      const plan = await ProtectionPlan.findById(planId)
      if (!plan || plan.status !== 'active') {
        return NextResponse.json({ success: false, error: 'Plan not available' }, { status: 400 })
      }
      lease.protectionPlanId = plan._id
    } else {
      lease.protectionPlanId = undefined
    }

    await lease.save()

    return NextResponse.json({ success: true, data: { protectionPlanId: lease.protectionPlanId?.toString() ?? null } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
