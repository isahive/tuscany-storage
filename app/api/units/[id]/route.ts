import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import '@/models/Lease'
import '@/models/Tenant'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    await connectDB()

    const unit = await Unit.findById(id)
      .populate('currentTenantId')
      .populate('currentLeaseId')

    if (!unit) {
      return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: unit })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

const updateUnitSchema = z.object({
  unitNumber: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  width: z.number().positive().optional(),
  depth: z.number().positive().optional(),
  type: z.enum(['standard', 'climate_controlled', 'drive_up', 'vehicle_outdoor']).optional(),
  floor: z.enum(['ground', 'upper']).optional(),
  price: z.number().int().positive().optional(),
  status: z.enum(['available', 'occupied', 'maintenance', 'reserved']).optional(),
  features: z.array(z.string()).optional(),
  notes: z.string().optional(),
  gridX: z.number().int().min(0).optional(),
  gridY: z.number().int().min(0).optional(),
  gridFloor: z.number().int().min(1).optional(),
})

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const parsed = updateUnitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    // Recalculate sqft if width or depth changed
    const updateData: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.width || parsed.data.depth) {
      const existing = await Unit.findById(id)
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
      }
      const width = parsed.data.width ?? existing.width
      const depth = parsed.data.depth ?? existing.depth
      updateData.sqft = width * depth
    }

    const unit = await Unit.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
    if (!unit) {
      return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: unit })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params

    await connectDB()

    const unit = await Unit.findById(id)
    if (!unit) {
      return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    }

    if (unit.status !== 'available') {
      return NextResponse.json(
        { success: false, error: 'Can only delete units with available status' },
        { status: 400 }
      )
    }

    await Unit.findByIdAndDelete(id)

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
