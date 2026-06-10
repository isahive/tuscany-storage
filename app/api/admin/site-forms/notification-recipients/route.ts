import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import ContactNotificationRecipient from '@/models/ContactNotificationRecipient'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') return null
  return session
}

export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    await connectDB()
    const recipients = await ContactNotificationRecipient.find().sort({ createdAt: 1 }).lean()
    const data = recipients.map((r: any) => ({
      id: r._id.toString(),
      email: r.email,
      active: r.active,
    }))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const { email } = await req.json()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 })
    }

    await connectDB()
    const recipient = await ContactNotificationRecipient.create({
      email: email.toLowerCase().trim(),
    })
    return NextResponse.json(
      { success: true, data: { id: recipient._id.toString(), email: recipient.email, active: recipient.active } },
      { status: 201 },
    )
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const { id, active } = await req.json()
    if (!id || typeof active !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    await connectDB()
    const updated = await ContactNotificationRecipient.findByIdAndUpdate(
      id,
      { active },
      { new: true },
    ).lean()
    if (!updated) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })

    await connectDB()
    const deleted = await ContactNotificationRecipient.findByIdAndDelete(id).lean()
    if (!deleted) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
