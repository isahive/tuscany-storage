import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import PrintBatch from '@/models/PrintBatch'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { id } = await params
    const batch = await PrintBatch.findById(id)
      .populate('items.tenantId', 'firstName lastName')

    if (!batch) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: batch })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { id } = await params
    const body = await req.json()

    const update: Record<string, unknown> = {}
    if (body.status === 'printed') {
      update.status = 'printed'
      update.printedAt = new Date()
    }

    const batch = await PrintBatch.findByIdAndUpdate(id, update, { new: true })
      .populate('items.tenantId', 'firstName lastName')

    if (!batch) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: batch })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
