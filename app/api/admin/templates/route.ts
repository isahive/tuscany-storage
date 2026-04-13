import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import NotificationTemplate from '@/models/NotificationTemplate'
import { DEFAULT_TEMPLATES } from '@/lib/defaultTemplates'

/** GET /api/admin/templates — list all templates (default first, then custom) */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    // Seed default templates if none exist
    const count = await NotificationTemplate.countDocuments({})
    if (count === 0) {
      await NotificationTemplate.insertMany(DEFAULT_TEMPLATES)
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
