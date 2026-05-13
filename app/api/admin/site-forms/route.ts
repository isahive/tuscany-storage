import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import ContactSubmission from '@/models/ContactSubmission'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const submissions = await ContactSubmission.find().sort({ createdAt: -1 }).lean()

    const data = submissions.map((s: any) => ({
      id: s._id.toString(),
      name: s.name,
      email: s.email,
      phone: s.phone ?? '',
      subject: s.subject ?? '',
      message: s.message,
      status: s.status,
      createdAt: s.createdAt,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id, status } = await req.json()
    if (!id || !['new', 'read', 'replied'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    await connectDB()

    const update: Record<string, unknown> = { status }
    if (status === 'replied') {
      update.repliedAt = new Date()
      update.repliedBy = session.user.name ?? 'Admin'
    }

    const submission = await ContactSubmission.findByIdAndUpdate(id, update, { new: true }).lean()
    if (!submission) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
