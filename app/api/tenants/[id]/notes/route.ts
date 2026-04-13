import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Note from '@/models/Note'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/tenants/:id/notes
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const notes = await Note.find({ tenantId: id }).sort({ createdAt: -1 })
    return NextResponse.json({ success: true, data: notes })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

const createNoteSchema = z.object({
  content: z.string().min(1),
  attachmentUrl: z.string().optional(),
  attachmentName: z.string().optional(),
})

// POST /api/tenants/:id/notes
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const parsed = createNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 })
    }

    await connectDB()

    const note = await Note.create({
      tenantId: id,
      ...parsed.data,
      createdBy: session.user.name ?? 'Admin',
    })

    return NextResponse.json({ success: true, data: note }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
