import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Notification from '@/models/Notification'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

// Strip HTML so email bodies (which are templated HTML) render as clean text
// in the portal — also sidesteps any markup rendering concerns.
function toPreview(body: string): string {
  return (body || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400)
}

/**
 * GET /api/portal/notifications
 * Returns the signed-in tenant's OWN sent notifications, newest first.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const notifs = await Notification.find({
      tenantId: session.user.id,
      status: 'sent',
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean<Array<any>>()

    const data = notifs.map((n) => ({
      id: String(n._id),
      type: n.type,
      channel: n.channel,
      subject: n.subject ?? '',
      preview: toPreview(n.body),
      date: n.sentAt ?? n.createdAt,
      opened: Boolean(n.openedAt),
      delivered: Boolean(n.deliveredAt),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
