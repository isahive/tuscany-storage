import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    await connectDB()

    const lease = await Lease.findById(id)
      .populate('tenantId')
      .populate('unitId')

    if (!lease) {
      return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })
    }

    // Non-admin tenants can only view their own leases
    if (session.user.role !== 'admin' && lease.tenantId._id.toString() !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: lease })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

const updateLeaseSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  moveOutDate: z.string().datetime().optional(),
  monthlyRate: z.number().int().positive().optional(),
  deposit: z.number().int().min(0).optional(),
  proratedFirstMonth: z.number().int().min(0).optional(),
  billingDay: z.number().int().min(1).max(28).optional(),
  status: z.enum(['active', 'ended', 'pending_moveout']).optional(),
  leaseDocumentUrl: z.string().optional(),
  lastRateChangeDate: z.string().datetime().optional(),
})

const tenantUpdateLeaseSchema = z.object({
  moveOutDate: z.string().datetime(),
})

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await req.json()

    await connectDB()

    const lease = await Lease.findById(id)
    if (!lease) {
      return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })
    }

    if (session.user.role === 'admin') {
      const parsed = updateLeaseSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
      }

      const updateData: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) {
          if (['startDate', 'endDate', 'moveOutDate', 'lastRateChangeDate'].includes(key)) {
            updateData[key] = new Date(value as string)
          } else {
            updateData[key] = value
          }
        }
      }

      const updated = await Lease.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      return NextResponse.json({ success: true, data: updated })
    } else {
      // Tenant can only set moveOutDate
      if (lease.tenantId.toString() !== session.user.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }

      const parsed = tenantUpdateLeaseSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
      }

      const updated = await Lease.findByIdAndUpdate(
        id,
        { moveOutDate: new Date(parsed.data.moveOutDate) },
        { new: true, runValidators: true }
      )
      return NextResponse.json({ success: true, data: updated })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
