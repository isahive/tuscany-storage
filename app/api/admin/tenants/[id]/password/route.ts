import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'

interface RouteContext {
  params: Promise<{ id: string }>
}

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

/**
 * POST /api/admin/tenants/[id]/password
 * Admin-only. Resets a tenant's login password.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    await connectDB()
    const hashed = await bcrypt.hash(parsed.data.password, 10)
    const tenant = await Tenant.findByIdAndUpdate(id, { password: hashed }, { new: true })
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
