import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { generateLease } from '@/lib/pdf'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'

interface RouteContext {
  params: Promise<{ id: string }>
}

const signLeaseSchema = z.object({
  signatureData: z.string().min(1),
})

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await req.json()

    const parsed = signLeaseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const lease = await Lease.findById(id)
    if (!lease) {
      return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })
    }

    // Verify the tenant owns this lease (or is admin)
    if (session.user.role !== 'admin' && lease.tenantId.toString() !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    if (lease.signedAt) {
      return NextResponse.json({ success: false, error: 'Lease already signed' }, { status: 400 })
    }

    const tenant = await Tenant.findById(lease.tenantId)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const unit = await Unit.findById(lease.unitId)
    if (!unit) {
      return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    }

    // Generate PDF
    await generateLease({
      tenantName: `${tenant.firstName} ${tenant.lastName}`,
      tenantEmail: tenant.email,
      unitNumber: unit.unitNumber,
      unitSize: unit.size,
      monthlyRate: lease.monthlyRate,
      deposit: lease.deposit,
      proratedFirstMonth: lease.proratedFirstMonth,
      startDate: lease.startDate,
      billingDay: lease.billingDay,
      signatureData: parsed.data.signatureData,
    })

    // Store placeholder PDF path (in production, upload to S3/cloud storage)
    const leaseDocumentUrl = `/documents/leases/${lease._id.toString()}.pdf`

    const updated = await Lease.findByIdAndUpdate(
      id,
      {
        signatureData: parsed.data.signatureData,
        signedAt: new Date(),
        leaseDocumentUrl,
      },
      { new: true, runValidators: true }
    )

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
