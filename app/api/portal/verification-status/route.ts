import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getVerificationStatus, tenantKey } from '@/lib/paymentVerification'

// GET /api/portal/verification-status
// Tells the portal payment form whether Cloudflare Turnstile should be
// rendered before letting the tenant submit. Used to mirror Storable Easy's
// "Web Visitor Verification" gate.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    await connectDB()
    const status = await getVerificationStatus(tenantKey(session.user.id))
    return NextResponse.json({ success: true, data: status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
