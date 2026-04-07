import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Notification from '@/models/Notification'
import type { ILeaseDocument } from '@/models/Lease'

interface RateIncreaseBatchItem {
  leaseId: string
  tenantId: string
  unitId: string
  currentRate: number
  proposedRate: number
  unitNumber: string
}

interface RateIncreaseBatch {
  id: string
  createdAt: Date
  status: 'pending' | 'approved' | 'rejected'
  items: RateIncreaseBatchItem[]
  increasePercentage: number
}

// In-memory batch storage (in production, use a proper model)
const batches: Map<string, RateIncreaseBatch> = new Map()

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const pendingBatches = Array.from(batches.values()).filter(b => b.status === 'pending')

    return NextResponse.json({
      success: true,
      data: pendingBatches,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

const createBatchSchema = z.object({
  increasePercentage: z.number().positive().max(100).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createBatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const increasePercentage = parsed.data.increasePercentage ?? 5

    await connectDB()

    const now = new Date()
    const twelveMonthsAgo = new Date(now)
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    // Find active leases where tenant has been >= 12 months and no rate change in 12 months
    const eligibleLeases = await Lease.find({
      status: 'active',
      startDate: { $lte: twelveMonthsAgo },
      $or: [
        { lastRateChangeDate: { $exists: false } },
        { lastRateChangeDate: null },
        { lastRateChangeDate: { $lte: twelveMonthsAgo } },
      ],
    }).populate('unitId') as (ILeaseDocument & { unitId: { _id: string; unitNumber: string; type: string } })[]

    // Check occupancy >= 90% per unit type
    const unitTypes = [...new Set(eligibleLeases.map(l => l.unitId.type))]
    const highOccupancyTypes: string[] = []

    for (const unitType of unitTypes) {
      const totalOfType = await Unit.countDocuments({ type: unitType })
      const occupiedOfType = await Unit.countDocuments({ type: unitType, status: 'occupied' })
      const occupancyRate = totalOfType > 0 ? occupiedOfType / totalOfType : 0
      if (occupancyRate >= 0.9) {
        highOccupancyTypes.push(unitType)
      }
    }

    const qualifiedLeases = eligibleLeases.filter(l => highOccupancyTypes.includes(l.unitId.type))

    if (qualifiedLeases.length === 0) {
      return NextResponse.json({
        success: true,
        data: { message: 'No eligible tenants found for rate increase', batch: null },
      })
    }

    const batchItems: RateIncreaseBatchItem[] = qualifiedLeases.map(lease => ({
      leaseId: lease._id.toString(),
      tenantId: lease.tenantId.toString(),
      unitId: lease.unitId._id.toString(),
      currentRate: lease.monthlyRate,
      proposedRate: Math.ceil(lease.monthlyRate * (1 + increasePercentage / 100)),
      unitNumber: lease.unitId.unitNumber,
    }))

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const batch: RateIncreaseBatch = {
      id: batchId,
      createdAt: new Date(),
      status: 'pending',
      items: batchItems,
      increasePercentage,
    }

    batches.set(batchId, batch)

    return NextResponse.json({ success: true, data: batch }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

const patchBatchSchema = z.object({
  batchId: z.string().min(1),
  action: z.enum(['approve', 'reject']),
})

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = patchBatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const batch = batches.get(parsed.data.batchId)
    if (!batch) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 })
    }

    if (batch.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Batch already processed' }, { status: 400 })
    }

    await connectDB()

    if (parsed.data.action === 'reject') {
      batch.status = 'rejected'
      batches.set(parsed.data.batchId, batch)
      return NextResponse.json({ success: true, data: batch })
    }

    // Approve: update all leases and notify tenants
    batch.status = 'approved'

    for (const item of batch.items) {
      await Lease.findByIdAndUpdate(item.leaseId, {
        monthlyRate: item.proposedRate,
        lastRateChangeDate: new Date(),
      })

      await Notification.create({
        tenantId: item.tenantId,
        type: 'rate_change_notice',
        channel: 'email',
        subject: 'Monthly Rate Update',
        body: `Your monthly rate for unit ${item.unitNumber} will change from $${(item.currentRate / 100).toFixed(2)} to $${(item.proposedRate / 100).toFixed(2)}.`,
        status: 'pending',
      })
    }

    batches.set(parsed.data.batchId, batch)

    return NextResponse.json({ success: true, data: batch })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
