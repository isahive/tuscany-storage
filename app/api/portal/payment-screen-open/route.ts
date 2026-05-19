import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { recordScreenOpen, tenantKey } from '@/lib/paymentVerification'

// POST /api/portal/payment-screen-open
// Called once when the tenant lands on /portal/payments/new. Storable triggers
// verification after the screen is opened 5 times without a success — this is
// where that streak is bumped.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    await connectDB()
    await recordScreenOpen(tenantKey(session.user.id))
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
