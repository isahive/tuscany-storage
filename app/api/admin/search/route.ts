import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'

/**
 * GET /api/admin/search?q=…
 *
 * Lightweight combined lookup powering the dashboard search bar. Returns a
 * small, capped set of matching clients and units so an autocomplete can
 * deep-link straight to the detail page. Kept deliberately thin (no joins)
 * so it stays fast on every keystroke.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (q.length < 1) {
      return NextResponse.json({ success: true, data: { clients: [], units: [] } })
    }

    await connectDB()

    // Escape regex metacharacters to prevent ReDoS / injection.
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rx = { $regex: escaped, $options: 'i' }

    const [tenants, units] = await Promise.all([
      Tenant.find({
        $or: [
          { firstName: rx },
          { lastName: rx },
          { email: rx },
          { phone: rx },
        ],
      })
        .select('firstName lastName email phone')
        .limit(8)
        .lean<Array<any>>(),
      Unit.find({ $or: [{ unitNumber: rx }, { size: rx }] })
        .select('unitNumber size status')
        .sort({ unitNumber: 1 })
        .limit(8)
        .lean<Array<any>>(),
    ])

    const clients = tenants.map((t) => ({
      id: String(t._id),
      name: `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() || '(no name)',
      detail: t.email || t.phone || '',
    }))

    const unitRows = units.map((u) => ({
      id: String(u._id),
      unitNumber: u.unitNumber,
      detail: [u.size, u.status].filter(Boolean).join(' · '),
    }))

    return NextResponse.json({ success: true, data: { clients, units: unitRows } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
