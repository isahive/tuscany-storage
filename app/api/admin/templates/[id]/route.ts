import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import NotificationTemplate from '@/models/NotificationTemplate'
import { DEFAULT_CUSTOM_TEMPLATES } from '@/lib/defaultCustomTemplates'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

/** GET /api/admin/templates/[id] — get a single template */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const template = await NotificationTemplate.findById(params.id).lean()
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/** PUT /api/admin/templates/[id] — update a template */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()

    // Don't allow changing the type field
    delete body.type

    const template = await NotificationTemplate.findByIdAndUpdate(
      params.id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean()

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/** DELETE /api/admin/templates/[id] — delete an admin-created template.
 *  Built-in default/custom templates match Storable behavior: editable, not deletable.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const template = await NotificationTemplate.findById(params.id)
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    const seededCustomNames = new Set(DEFAULT_CUSTOM_TEMPLATES.map((t) => t.name))
    if (template.type === 'default' || seededCustomNames.has(template.name)) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete built-in templates' },
        { status: 400 }
      )
    }

    await NotificationTemplate.findByIdAndDelete(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
