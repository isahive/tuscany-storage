import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import { sendTemplatedNotification } from '@/lib/sendNotification'

const schema = z.object({
  effectiveDate: z.string(),
  units: z
    .array(z.object({
      unitNumber: z.string(),
      proposedRate: z.number().int().min(0),
    }))
    .min(1),
})

/**
 * POST /api/admin/rate-management/send-scheduled-notice
 * Admin-only manual trigger for the "Notice of Scheduled Rate Change" template.
 * Doesn't change any RateChange status — purely informational, sent to one or
 * more customers when scheduling rental price changes (matches the live
 * Storable "Manual Only" behavior).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    await connectDB()

    const effective = new Date(parsed.data.effectiveDate)
    const results: Array<{ unitNumber: string; status: 'sent' | 'skipped'; reason?: string }> = []

    for (const u of parsed.data.units) {
      const unit = await Unit.findOne({ unitNumber: u.unitNumber })
      if (!unit) { results.push({ unitNumber: u.unitNumber, status: 'skipped', reason: 'unit not found' }); continue }

      const lease = await Lease.findOne({ unitId: unit._id, status: 'active' })
      if (!lease) { results.push({ unitNumber: u.unitNumber, status: 'skipped', reason: 'no active lease' }); continue }

      const tenant = await Tenant.findById(lease.tenantId)
      if (!tenant) { results.push({ unitNumber: u.unitNumber, status: 'skipped', reason: 'no tenant' }); continue }

      await sendTemplatedNotification({
        templateName: 'Notice of Scheduled Rate Change',
        notificationType: 'rate_change_notice',
        tenant: tenant as any,
        unitNumber: unit.unitNumber,
        unitSize: unit.size,
        monthlyRate: u.proposedRate,
        dueDate: effective,
      })

      results.push({ unitNumber: u.unitNumber, status: 'sent' })
    }

    const sent = results.filter((r) => r.status === 'sent').length
    return NextResponse.json({ success: true, data: { sent, total: results.length, results } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
