import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import { findDuplicates, type TenantForMatch } from '@/lib/tenantDuplicates'

/**
 * GET /api/admin/tenants/duplicates
 *
 * Scans every (non-archived, non-walk-in) tenant and groups together accounts
 * that look like the same human — matching cards, names, addresses, phones,
 * or emails. Used by /admin/tenants/duplicates so the operator can link or
 * dismiss them.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const tenants = await Tenant.find(
      { archived: { $ne: true }, isRetailWalkIn: { $ne: true } },
      {
        firstName: 1,
        lastName: 1,
        email: 1,
        phone: 1,
        address: 1,
        zip: 1,
        billingAddress: 1,
        cardFingerprint: 1,
        linkedTenantIds: 1,
        dismissedMatchIds: 1,
      },
    ).lean()

    const projected: TenantForMatch[] = tenants.map((t) => ({
      id: String(t._id),
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      phone: t.phone,
      address: t.address,
      zip: t.zip,
      billingAddress: t.billingAddress,
      cardFingerprint: t.cardFingerprint,
      linkedTenantIds: (t.linkedTenantIds || []).map(String),
      dismissedMatchIds: (t.dismissedMatchIds || []).map(String),
    }))

    const matches = findDuplicates(projected)

    // Build a per-pair payload the UI can render directly. Only keep one
    // direction so we don't show duplicates of duplicates in the panel.
    const seen = new Set<string>()
    const byId = new Map(projected.map((t) => [t.id, t]))
    const pairs = matches
      .filter((m) => {
        const key = [m.tenantId, m.otherId].sort().join('::')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((m) => {
        const a = byId.get(m.tenantId)!
        const b = byId.get(m.otherId)!
        return {
          a: {
            id: a.id,
            firstName: a.firstName,
            lastName: a.lastName,
            email: a.email,
            phone: a.phone,
          },
          b: {
            id: b.id,
            firstName: b.firstName,
            lastName: b.lastName,
            email: b.email,
            phone: b.phone,
          },
          reasons: m.reasons,
          confidence: m.confidence,
        }
      })

    return NextResponse.json({
      success: true,
      data: { pairs, scanned: projected.length, found: pairs.length },
    })
  } catch (err) {
    console.error('GET /api/admin/tenants/duplicates failed', err)
    return NextResponse.json(
      { success: false, error: 'Failed to scan duplicates' },
      { status: 500 },
    )
  }
}
