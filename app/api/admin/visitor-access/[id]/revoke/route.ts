/**
 * Cancel an active VisitorAccess pass before its window expires.
 * Idempotent at the application layer — re-revoking a revoked/expired pass
 * returns 409 so the UI can refetch.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
  revokeVisitorAccess,
  VisitorAccessValidationError,
} from '@/lib/visitorAccessService'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const revokedBy = session.user.email ?? session.user.name ?? 'admin'
    const doc = await revokeVisitorAccess({ id: params.id, revokedBy })

    return NextResponse.json({
      success: true,
      data: {
        id: String(doc._id),
        status: doc.status,
        revokedAt: doc.revokedAt,
        revokedBy: doc.revokedBy,
      },
    })
  } catch (error) {
    if (error instanceof VisitorAccessValidationError) {
      const status = error.message.includes('not found') ? 404 : 409
      return NextResponse.json({ success: false, error: error.message }, { status })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
