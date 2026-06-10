import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

// GET /api/admin/retail/walk-in-tenant
// Returns (creating if needed) the singleton synthetic "Retail Sale" tenant
// Storable maps walk-in purchases against. There's exactly one per facility
// — the email collision constraint enforces that.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const SENTINEL_EMAIL = 'retail-walk-in@internal.tuscanystorage'

    let tenant = await Tenant.findOne({ isRetailWalkIn: true })
    if (!tenant) {
      // Lazy-create on first request. The fake email + disabled login keeps
      // the synthetic profile from clashing with anything tenant-side.
      tenant = await Tenant.create({
        firstName: 'Retail',
        lastName: 'Walk-In',
        email: SENTINEL_EMAIL,
        phone: '0000000000',
        password: await bcrypt.hash(`walkin-${Date.now()}`, 12),
        role: 'tenant',
        status: 'active',
        loginDisabled: true,
        isRetailWalkIn: true,
      })
    }

    return NextResponse.json({
      success: true,
      data: { _id: String(tenant._id), firstName: tenant.firstName, lastName: tenant.lastName },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
