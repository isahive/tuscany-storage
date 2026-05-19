import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import RateManagementBatch from '@/models/RateManagementBatch'
import RateChange from '@/models/RateChange'

const schema = z.object({
  rateChangeId: z.string().min(1),
})

// POST /api/admin/rate-management/batches/[id]/cancel-item
// Cancels one scheduled rental rate change within a batch. The underlying
// RateChange row is flipped to 'rejected' so the execution cron won't apply
// it; the batch line item gets `cancelledAt` stamped for the audit trail.
// When the LAST live item is cancelled, the batch status flips to
// 'cancelled' (Storable surfaces this in the Batches list).
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
      return NextResponse.json({ success: false, error: 'Already cancelled' }, { status: 409 })
    }

    await RateChange.findByIdAndUpdate(parsed.data.rateChangeId, {
      status: 'rejected',
      rejectionReason: `Cancelled by ${session.user.email ?? 'admin'} from batch ${params.id}`,
    })

    item.cancelledAt = new Date()

    // Flip batch status when nothing live remains.
    const liveCount = batch.rentalChanges.filter((r: any) => !r.cancelledAt).length
    if (liveCount === 0) batch.status = 'cancelled'
    else if (batch.status === 'submitted') batch.status = 'partially_cancelled'

    await batch.save()

    return NextResponse.json({ success: true, data: { cancelled: true, status: batch.status } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
