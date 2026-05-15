import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import RateChange from '@/models/RateChange'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'

const schema = z.object({
  action: z.enum(['approve', 'reject']),
  effectiveDate: z.string(),
  rejectionReason: z.string().optional(),
  units: z
    .array(
      z.object({
        unitNumber: z.string(),
        currentRate: z.number(),
        proposedRate: z.number(),
      }),
    )
    .min(1),
})

// POST /api/admin/rate-management/batch-approve
// Bulk creates RateChange records for a batch of unit→tenant pairs, marking each
// approved or rejected. On approve, sends a 30-day notice to the tenant.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }
    const { action, effectiveDate, rejectionReason, units } = parsed.data

    await connectDB()

    const effective = new Date(effectiveDate)
    const now = new Date()
    const results: Array<{ unitNumber: string; status: string; reason?: string }> = []

    for (const u of units) {
      try {
        const unit = await Unit.findOne({ unitNumber: u.unitNumber })
        if (!unit) {
          results.push({ unitNumber: u.unitNumber, status: 'skipped', reason: 'unit not found' })
          continue
        }

        const lease = await Lease.findOne({ unitId: unit._id, status: 'active' })
        if (!lease) {
          results.push({ unitNumber: u.unitNumber, status: 'skipped', reason: 'no active lease' })
          continue
        }

        // De-dupe — skip if a non-final proposal already exists
        const existing = await RateChange.findOne({
          leaseId: lease._id,
          status: { $in: ['proposed', 'approved'] },
        })
        if (existing) {
          results.push({ unitNumber: u.unitNumber, status: 'skipped', reason: 'open proposal exists' })
          continue
        }

        const change = await RateChange.create({
          tenantId: lease.tenantId,
          leaseId: lease._id,
          unitId: unit._id,
          currentRate: u.currentRate,
          proposedRate: u.proposedRate,
          effectiveDate: effective,
          status: action === 'approve' ? 'approved' : 'rejected',
          approvedBy: session.user.id,
          approvedAt: now,
          ...(action === 'reject' && rejectionReason ? { rejectionReason } : {}),
        })

        // No auto email — "Notice of Scheduled Rate Change" is Manual Only.

        results.push({ unitNumber: u.unitNumber, status: action === 'approve' ? 'approved' : 'rejected' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'error'
        results.push({ unitNumber: u.unitNumber, status: 'error', reason: msg })
      }
    }

    return NextResponse.json({ success: true, data: { action, results } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
