import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import NotificationTemplate from '@/models/NotificationTemplate'
import { DEFAULT_TEMPLATES } from '@/lib/defaultTemplates'
import { DEFAULT_CUSTOM_TEMPLATES } from '@/lib/defaultCustomTemplates'

/** GET /api/admin/templates — list all templates (default first, then custom) */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    // Insert any default templates that aren't yet in the DB (idempotent —
    // existing rows are left untouched so admin edits aren't overwritten).
    const existing = await NotificationTemplate.find({}).select('name type').lean() as Array<{ name: string; type: 'default' | 'custom' }>
    const existingNames = new Set(existing.map((t) => t.name))
    const defaultNames = new Set(DEFAULT_TEMPLATES.map((t) => t.name))

    const missing = [
      ...DEFAULT_TEMPLATES.filter((t) => !existingNames.has(t.name)),
      ...DEFAULT_CUSTOM_TEMPLATES.filter((t) => !existingNames.has(t.name)),
    ]
    if (missing.length > 0) {
      await NotificationTemplate.insertMany(missing)
    }

    // Remove stale defaults — rows tagged type='default' whose name no longer
    // appears in DEFAULT_TEMPLATES. Custom (admin-created) rows are never
    // touched. This keeps the list in sync when we retire a default.
    const stale = existing
      .filter((t) => t.type === 'default' && !defaultNames.has(t.name))
      .map((t) => t.name)
    if (stale.length > 0) {
      await NotificationTemplate.deleteMany({ type: 'default', name: { $in: stale } })
    }

    const templates = await NotificationTemplate.find({})
      .sort({ type: 1, name: 1 }) // 'custom' sorts after 'default' alphabetically — flip: default first
      .lean()

    // Ensure defaults come first
    const sorted = [
      ...templates.filter((t: any) => t.type === 'default'),
      ...templates.filter((t: any) => t.type === 'custom'),
    ]

    return NextResponse.json({ success: true, data: sorted })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/** POST /api/admin/templates — create a custom template */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()

    // Force custom type for new templates created by admins
    const template = await NotificationTemplate.create({
      ...body,
      type: 'custom',
    })

    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
