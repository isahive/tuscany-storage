import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

interface RouteContext {
  params: Promise<{ id: string }>
}

const Body = z.object({ targetId: z.string().min(1) })

/**
 * POST /api/admin/tenants/[id]/unlink
 * Removes the bidirectional link between two tenants. Idempotent.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 })
    }
    const { targetId } = parsed.data

    await connectDB()
    await Promise.all([
      Tenant.updateOne({ _id: id }, { $pull: { linkedTenantIds: targetId } }),
      Tenant.updateOne({ _id: targetId }, { $pull: { linkedTenantIds: id } }),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST unlink failed', err)
    return NextResponse.json({ success: false, error: 'Failed to unlink' }, { status: 500 })
  }
}
