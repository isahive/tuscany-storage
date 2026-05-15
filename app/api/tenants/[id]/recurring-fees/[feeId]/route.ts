import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import RecurringFee from '@/models/RecurringFee'

interface RouteContext {
  params: Promise<{ id: string; feeId: string }>
}

// DELETE — soft-delete by flipping active to false (preserves audit trail).
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id, feeId } = await context.params
  await connectDB()

  const fee = await RecurringFee.findOneAndUpdate(
    { _id: feeId, tenantId: id },
    { active: false },
    { new: true },
  )
  if (!fee) {
    return NextResponse.json({ success: false, error: 'Recurring fee not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: fee })
}
