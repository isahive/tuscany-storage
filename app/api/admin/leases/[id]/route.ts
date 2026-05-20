import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'

const patchSchema = z.object({
  // Currently surfaces post-creation editable lease fields. Add more
  // (autopay overrides, billing-day moves, etc.) as features need them.
  exemptFromRateManagement: z.boolean().optional(),
})

// PATCH /api/admin/leases/[id]
// Generic post-creation lease editor. Storable parity for the Customer
// Profile → Rentals → Edit Billing path (currently just the
// "Exempt from Rate Management" toggle but the schema is open for more).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    await connectDB()

    const lease = await Lease.findByIdAndUpdate(
      params.id,
      { $set: parsed.data },
      { new: true },
    )
    if (!lease) return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: { _id: String(lease._id), exemptFromRateManagement: lease.exemptFromRateManagement } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
