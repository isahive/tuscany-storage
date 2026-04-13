import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'

const schema = z.object({
  signatureData: z.string().min(1),
  signatureType: z.enum(['drawn', 'typed']),
})

interface RouteContext {
  params: Promise<{ leaseId: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { leaseId } = await context.params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid signature data' }, { status: 400 })
    }

    await connectDB()

    const lease = await Lease.findById(leaseId)
    if (!lease) {
      return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })
    }

    lease.signatureData = parsed.data.signatureData
    lease.signedAt = new Date()
    await lease.save()

    // Now that the lease is signed, mark the unit as occupied
    await Unit.findByIdAndUpdate(lease.unitId, { status: 'occupied' })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
