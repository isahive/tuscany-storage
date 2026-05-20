import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import RateChange from '@/models/RateChange'
import RateManagementBatch from '@/models/RateManagementBatch'
import Settings from '@/models/Settings'
import PrintBatch from '@/models/PrintBatch'
import { calcOccupancyByType } from '@/lib/rateManagement'
import { sendTemplatedNotification } from '@/lib/sendNotification'

const schema = z.object({
  notifChannels: z.array(z.enum(['email', 'text', 'print'])),
  source: z.enum(['rate_management', 'mass_edit']).default('rate_management'),
  unitTypeChanges: z.array(z.object({
    unitType: z.string().min(1),
    newPrice: z.number().int().min(0),
    newTargetOccupancyPct: z.number().min(0).max(100).optional(),
  })).default([]),
  rentalChanges: z.array(z.object({
    leaseId: z.string().min(1),
    unitId: z.string().min(1),
    tenantId: z.string().min(1),
    currentRate: z.number().int().min(0),
    proposedRate: z.number().int().min(0),
    notificationDate: z.string(),
    changeDate: z.string(),
  })).default([]),
})

// POST /api/admin/rate-management/submit
// Persists everything from the Summary page in a single transaction-like flow.
// Storable parity:
//   - Unit Type Price changes update Unit.price for ALL units of that type
//     immediately (street rate applies right away to new rentals).
//   - Rental changes create RateChange rows in 'approved' status; the
//     execution cron flips Lease.monthlyRate when changeDate arrives.
//   - Notifications are dispatched per the chosen channels.
//   - One RateManagementBatch row records everything for the Batches page.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }
    const { notifChannels, source, unitTypeChanges, rentalChanges } = parsed.data

    if (unitTypeChanges.length === 0 && rentalChanges.length === 0) {
      return NextResponse.json({ success: false, error: 'No changes selected' }, { status: 400 })
    }

    await connectDB()

    // ── Unit Type Price Changes ──
    const units = await Unit.find().lean<Array<{ _id: any; type: string; price: number; status: string }>>()
    const occupancyByType = calcOccupancyByType(units.map((u) => ({ type: u.type, status: u.status })))
    const unitTypeChangeRows = []

    for (const c of unitTypeChanges) {
      const typedUnits = units.filter((u) => u.type === c.unitType)
      if (typedUnits.length === 0) continue
      const previousPrice = typedUnits[0].price // representative
      // Apply the new street rate to all units of this type.
      await Unit.updateMany({ type: c.unitType }, { $set: { price: c.newPrice } })

      // Optionally update the rule's minOccupancyPct so the same unit type
      // doesn't keep firing on the next cron run.
      if (c.newTargetOccupancyPct !== undefined) {
        await Settings.updateOne(
          { 'unitTypePriceRules.unitType': c.unitType },
          { $set: { 'unitTypePriceRules.$.minOccupancyPct': c.newTargetOccupancyPct } },
        )
      }

      unitTypeChangeRows.push({
        unitType: c.unitType,
        previousPrice,
        newPrice: c.newPrice,
        occupancyAtSubmit: occupancyByType[c.unitType]?.rate ?? 0,
        targetOccupancyAfter: c.newTargetOccupancyPct,
        affectedUnitCount: typedUnits.length,
      })
    }

    // ── Rental Price Changes ──
    const rentalChangeRows = []
    const printItems: Array<{ tenantId: any; unitNumber: string; documentType: string; balance: number }> = []

    for (const c of rentalChanges) {
      const lease = await Lease.findById(c.leaseId)
      if (!lease) continue
      const unit = await Unit.findById(c.unitId)
      if (!unit) continue
      const tenant = await Tenant.findById(c.tenantId)
      if (!tenant) continue

      // Mark any pre-existing 'proposed' row for this lease as 'rejected' (the
      // admin is replacing it with the chosen value from the Summary page).
      await RateChange.updateMany(
        { leaseId: c.leaseId, status: 'proposed' },
        { $set: { status: 'rejected', rejectionReason: 'Replaced by Summary submit' } },
      )

      const change = await RateChange.create({
        tenantId: c.tenantId,
        leaseId: c.leaseId,
        unitId: c.unitId,
        currentRate: c.currentRate,
        proposedRate: c.proposedRate,
        effectiveDate: new Date(c.changeDate),
        status: 'approved',
        approvedBy: session.user.id,
        approvedAt: new Date(),
      })

      rentalChangeRows.push({
        rateChangeId: change._id,
        tenantId: tenant._id,
        leaseId: lease._id,
        unitId: unit._id,
        unitNumber: unit.unitNumber,
        currentRate: c.currentRate,
        proposedRate: c.proposedRate,
        notificationDate: new Date(c.notificationDate),
        changeDate: new Date(c.changeDate),
      })

      // ── Notifications ──
      const sendEmail = notifChannels.includes('email')
      const sendText = notifChannels.includes('text')
      const queuePrint = notifChannels.includes('print')

      if (sendEmail || sendText) {
        await sendTemplatedNotification({
          templateName: 'Notice of Scheduled Rate Change',
          notificationType: 'rate_change_notice',
          tenant,
          unitNumber: unit.unitNumber,
          monthlyRate: c.proposedRate,
          balance: tenant.balance ?? 0,
          dueDate: new Date(c.changeDate),
        })
      }
      if (queuePrint) {
        printItems.push({
          tenantId: tenant._id,
          unitNumber: unit.unitNumber,
          documentType: 'rate_change_notice',
          balance: tenant.balance ?? 0,
        })
      }
    }

    // ── Persist a single PrintBatch row for the queue_print items ──
    if (printItems.length > 0) {
      await PrintBatch.create({
        items: printItems,
        format: 'letter',
        status: 'created',
        createdBy: session.user.name ?? session.user.email ?? 'admin',
      })
    }

    // ── Record the batch ──
    const batch = await RateManagementBatch.create({
      createdBy: session.user.name ?? session.user.email ?? 'admin',
      source,
      status: 'submitted',
      notifChannels,
      unitTypeChanges: unitTypeChangeRows,
      rentalChanges: rentalChangeRows,
    })

    return NextResponse.json({ success: true, data: { batchId: batch._id } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
