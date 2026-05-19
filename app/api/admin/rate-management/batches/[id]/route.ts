import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import RateManagementBatch from '@/models/RateManagementBatch'

// GET /api/admin/rate-management/batches/[id]
// Returns one batch with all rental + unit-type change rows so the detail
// page can render the Scheduled Price Changes table.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()
    const batch = await RateManagementBatch.findById(params.id).lean()
    if (!batch) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: batch })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
