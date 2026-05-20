import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import RateManagementBatch from '@/models/RateManagementBatch'
import PrintBatch from '@/models/PrintBatch'
import Tenant from '@/models/Tenant'

const schema = z.object({
  rateChangeId: z.string().min(1),
})

// POST /api/admin/rate-management/batches/[id]/reprint-item
// Storable Scheduled Price Change "Reprint" — queues another print of the
// notification letter for an existing rate-change row. Only valid when the
// batch's notifChannels included 'print'.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Missing rateChangeId' }, { status: 400 })
    }

    await connectDB()

    const batch = await RateManagementBatch.findById(params.id)
    if (!batch) return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })
    if (!batch.notifChannels.includes('print')) {
      return NextResponse.json(
        { success: false, error: 'This batch did not select Print as a notification channel.' },
        { status: 409 },
      )
    }

    const item = batch.rentalChanges.find((r: any) => String(r.rateChangeId) === parsed.data.rateChangeId)
    if (!item) return NextResponse.json({ success: false, error: 'Item not in batch' }, { status: 404 })
    if (item.cancelledAt) {
      return NextResponse.json({ success: false, error: 'Cannot reprint a cancelled item' }, { status: 409 })
    }

    const tenant = await Tenant.findById(item.tenantId).select('balance').lean<{ balance?: number } | null>()

    await PrintBatch.create({
      items: [{
        tenantId: item.tenantId,
        unitNumber: item.unitNumber,
        documentType: 'rate_change_notice_reprint',
        balance: tenant?.balance ?? 0,
      }],
      format: 'letter',
      status: 'created',
      createdBy: session.user.name ?? session.user.email ?? 'admin',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
