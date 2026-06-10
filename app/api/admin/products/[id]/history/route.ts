import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import InventoryAdjustment from '@/models/InventoryAdjustment'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

// GET /api/admin/products/[id]/history?from=ISO&to=ISO
// Returns the inventory ledger for one product, newest first, optionally
// bounded by a date range. Used by the Retail Inventory Summary report and
// per-product detail page.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = req.nextUrl
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const filter: Record<string, unknown> = { productId: params.id }
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.$gte = new Date(from)
      if (to) range.$lte = new Date(to)
      filter.createdAt = range
    }

    const rows = await InventoryAdjustment.find(filter)
      .populate('tenantId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
