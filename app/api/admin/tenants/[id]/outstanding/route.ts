import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Payment from '@/models/Payment'
import Tenant from '@/models/Tenant'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/tenants/[id]/outstanding
 * Returns unpaid line items (Payment records with status=pending) for this tenant
 * plus the running credit balance (if any).
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const tenant = await Tenant.findById(id).lean()
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const items = await Payment.find({
      tenantId: id,
      status: 'pending',
      type: { $in: ['rent', 'late_fee', 'deposit', 'prorated', 'other'] },
    })
      .sort({ createdAt: 1 })
      .lean()

    const balance = (tenant as any).balance ?? 0

    return NextResponse.json({
      success: true,
      data: {
        items: items.map((p: any) => ({
          id: String(p._id),
          dateCreated: p.createdAt,
          amount: p.amount,
          taxRate: p.taxRate ?? 0,
          description: p.description ?? '',
          type: p.type,
        })),
        credit: balance < 0 ? -balance : 0,
        outstanding: balance > 0 ? balance : 0,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
