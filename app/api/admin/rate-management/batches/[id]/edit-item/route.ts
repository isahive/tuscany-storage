import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import RateManagementBatch from '@/models/RateManagementBatch'
import RateChange from '@/models/RateChange'

const schema = z.object({
  rateChangeId: z.string().min(1),
  newProposedRate: z.number().int().min(0),
})

// POST /api/admin/rate-management/batches/[id]/edit-item
// Updates the New Monthly Price on a scheduled rental rate change. Mirrors
// Storable's "Scheduled Price Change" edit form. Refuses to edit cancelled
// items so the audit trail stays consistent.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

    await connectDB()

    const batch = await RateManagementBatch.findById(params.id)
    if (!batch) return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })

    const item = batch.rentalChanges.find((r: any) => String(r.rateChangeId) === parsed.data.rateChangeId)
    if (!item) return NextResponse.json({ success: false, error: 'Item not in batch' }, { status: 404 })
    if (item.cancelledAt) {
      return NextResponse.json({ success: false, error: 'Cannot edit a cancelled item' }, { status: 409 })
    }

    await RateChange.findByIdAndUpdate(parsed.data.rateChangeId, {
      proposedRate: parsed.data.newProposedRate,
    })
    item.proposedRate = parsed.data.newProposedRate
    await batch.save()

    return NextResponse.json({ success: true, data: { newProposedRate: parsed.data.newProposedRate } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
