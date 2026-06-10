import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import TenantAlteration from '@/models/TenantAlteration'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

// GET /api/admin/tenants/[id]/alterations
// Storable's "Tenant Alterations" page. Returns all audit rows for the tenant,
// newest first. Used to surface who added / removed a promotion, rate changes,
// etc.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const rows = await TenantAlteration.find({ tenantId: params.id })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
