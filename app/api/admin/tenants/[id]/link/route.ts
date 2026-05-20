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
 * POST /api/admin/tenants/[id]/link
 * Confirms two tenant accounts are the same human. The link is bidirectional
 * and idempotent. Also clears any prior dismissal so the pair is treated as
 * intentionally linked.
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
    if (id === targetId) {
      return NextResponse.json(
        { success: false, error: 'Cannot link a tenant to itself' },
        { status: 400 },
      )
    }

    await connectDB()
    const [a, b] = await Promise.all([Tenant.findById(id), Tenant.findById(targetId)])
    if (!a || !b) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    await Promise.all([
      Tenant.updateOne(
        { _id: a._id },
        {
          $addToSet: { linkedTenantIds: b._id },
          $pull: { dismissedMatchIds: b._id },
        },
      ),
      Tenant.updateOne(
        { _id: b._id },
        {
          $addToSet: { linkedTenantIds: a._id },
          $pull: { dismissedMatchIds: a._id },
        },
      ),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST link failed', err)
    return NextResponse.json({ success: false, error: 'Failed to link' }, { status: 500 })
  }
}
