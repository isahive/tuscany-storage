import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'

// POST /api/tenants/[id]/balance — recalculate balance
// GET /api/tenants/[id]/balance — get current balance with breakdown
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    // Tenants can only see their own balance
    if (session.user.role !== 'admin' && session.user.id !== params.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const tenant = await Tenant.findById(params.id)
    if (!tenant) return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })

    // Get active lease for monthly rate
    const lease = await Lease.findOne({ tenantId: params.id, status: 'active' })

    // Calculate total charges (what they should have paid)
    // and total payments (what they actually paid)
    const succeededPayments = await Payment.find({
      tenantId: params.id,
      status: 'succeeded',
    }).lean()

    const refundedPayments = await Payment.find({
      tenantId: params.id,
      status: 'refunded',
    }).lean()

    const totalPaid = succeededPayments.reduce((sum: number, p: any) => sum + p.amount, 0)
    const totalRefunded = refundedPayments.reduce((sum: number, p: any) => sum + p.amount, 0)

    // Calculate total charges from lease history
    // For simplicity: each month since lease start date = 1 month of rent
    let totalCharges = 0
    if (lease) {
      const start = new Date(lease.startDate)
      const now = new Date()
      const months = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
      totalCharges = months * lease.monthlyRate
      // Add deposit
      totalCharges += lease.deposit || 0
    }

    const balance = totalCharges - totalPaid + totalRefunded

    // Update tenant balance
    tenant.balance = balance
    await tenant.save()

    return NextResponse.json({
      success: true,
      data: {
        balance,
        totalCharges,
        totalPaid,
        totalRefunded,
        monthlyRate: lease?.monthlyRate ?? 0,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Same as GET but forces recalculation
  return GET(req, { params })
}
