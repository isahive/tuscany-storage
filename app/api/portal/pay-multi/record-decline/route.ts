import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { recordFailedPayment, tenantKey } from '@/lib/paymentVerification'

// POST /api/portal/pay-multi/record-decline
// Reports a client-side stripe.confirmCardPayment failure (card declined,
// 3DS rejected, etc.) so the failed-payment streak still counts. Without
// this, declines that happen in the browser never reach the server's
// finalize endpoint, so the Storable "5 fails in a row" trigger never fires.
//
// Spoofable, but the only impact of a fake report is the tenant triggering
// their own CAPTCHA — they're authenticated and can only affect themselves.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    await connectDB()
    await recordFailedPayment(tenantKey(session.user.id))
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
