import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/tenants/[id]/linked
 * Lightweight projection of the tenants explicitly linked to this one.
 * Powers the "linked account" banner on the tenant detail page.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const tenant = await Tenant.findById(id, { linkedTenantIds: 1 }).lean<{
      linkedTenantIds?: unknown[]
    }>()
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const ids = tenant.linkedTenantIds || []
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: { linked: [] } })
    }

    const linked = await Tenant.find(
      { _id: { $in: ids } },
      { firstName: 1, lastName: 1, email: 1, phone: 1, status: 1 },
    ).lean()

    return NextResponse.json({
      success: true,
      data: {
        linked: linked.map((t) => ({
          id: String(t._id),
          firstName: t.firstName,
          lastName: t.lastName,
          email: t.email,
          phone: t.phone,
          status: t.status,
        })),
      },
    })
  } catch (err) {
    console.error('GET linked failed', err)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}
