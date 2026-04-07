import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { calculateProratedAmount, generateGateCode } from '@/lib/utils'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import AccessLog from '@/models/AccessLog'

const moveInSchema = z.object({
  tenantId: z.string().min(1),
  unitId: z.string().min(1),
  startDate: z.string().datetime(),
  paymentMethodId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = moveInSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    // Step 1: Validate tenant exists and unit is available
    const tenant = await Tenant.findById(parsed.data.tenantId)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const unit = await Unit.findById(parsed.data.unitId)
    if (!unit) {
      return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    }

    if (unit.status !== 'available') {
      return NextResponse.json({ success: false, error: 'Unit is not available' }, { status: 400 })
    }

    const startDate = new Date(parsed.data.startDate)

    // Step 2: Calculate prorated first month
    const proratedAmount = calculateProratedAmount(unit.price, startDate)

    // Step 3: Create Lease
    const lease = await Lease.create({
      tenantId: tenant._id,
      unitId: unit._id,
      startDate,
      monthlyRate: unit.price,
      deposit: 0,
      proratedFirstMonth: proratedAmount,
      billingDay: startDate.getDate() <= 28 ? startDate.getDate() : 1,
      status: 'active',
    })

    // Step 4: Update Unit
    await Unit.findByIdAndUpdate(unit._id, {
      status: 'occupied',
      currentTenantId: tenant._id,
      currentLeaseId: lease._id,
    })

    // Step 5: Create initial Payment record
    const periodEnd = new Date(startDate)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    periodEnd.setDate(0) // last day of start month

    await Payment.create({
      tenantId: tenant._id,
      leaseId: lease._id,
      unitId: unit._id,
      stripePaymentIntentId: `pi_movein_${crypto.randomBytes(12).toString('hex')}`,
      amount: proratedAmount,
      currency: 'usd',
      type: 'prorated',
      status: 'pending',
      periodStart: startDate,
      periodEnd,
      attemptCount: 0,
    })

    // Step 6: Generate gate code
    const gateCode = generateGateCode()
    await Tenant.findByIdAndUpdate(tenant._id, { gateCode, status: 'active' })

    await AccessLog.create({
      tenantId: tenant._id,
      unitId: unit._id,
      eventType: 'code_changed',
      gateId: 'entrance',
      source: 'admin',
      notes: 'Gate code assigned during move-in',
    })

    // Step 7: Log move-in notification (dev mode)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV NOTIFICATION] Move-in confirmation for ${tenant.firstName} ${tenant.lastName} to unit ${unit.unitNumber}`)
      console.log(`[DEV NOTIFICATION] Gate code: ${gateCode}`)
    }

    // Fetch updated documents
    const updatedUnit = await Unit.findById(unit._id)
    const updatedTenant = await Tenant.findById(tenant._id)

    return NextResponse.json({
      success: true,
      data: {
        lease,
        tenant: updatedTenant,
        unit: updatedUnit,
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
