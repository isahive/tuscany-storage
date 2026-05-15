import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { Types } from 'mongoose'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Payment from '@/models/Payment'
import { nextBalanceAfter } from '@/lib/paymentBalance'

interface RouteContext {
  params: Promise<{ id: string }>
}

const schema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
})

/**
 * POST /api/admin/tenants/[id]/void-line-items
 *
 * Cancels selected pending line items (rent, fees, deposits…).
 *
 * For each itemId:
 *   - Marks the original Payment row status='voided' (removes it from
 *     outstanding/balance tracking).
 *   - Creates a new "void" Payment row with direction='payment',
 *     status='voided' so the cancellation shows in the Payments/Voids column
 *     of billing history with a VOID badge.
 *   - Decrements tenant.balance by the original amount.
 *
 * Mirrors Storable Easy's "Mass Void Unpaid Line Items" flow.
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
    const tenant = await Tenant.findById(id)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const objectIds = parsed.data.itemIds
      .filter((s) => Types.ObjectId.isValid(s))
      .map((s) => new Types.ObjectId(s))

    const originals = await Payment.find({
      _id: { $in: objectIds },
      tenantId: tenant._id,
      status: 'pending',
    })

    if (originals.length === 0) {
      return NextResponse.json({ success: false, error: 'No pending items found for the supplied IDs' }, { status: 400 })
    }

    let voidedCount = 0
    let balanceDelta = 0
    const voidRows: Array<unknown> = []

    for (const original of originals) {
      // Mark the original line item as voided so it stops showing in outstanding.
      // (Its balanceAfter doesn't need adjusting — voided charges still count
      //  in the balance, the matching void payment row below offsets them.)
      original.status = 'voided'
      await original.save()

      // Create the void-side row that surfaces in the Payments/Voids column.
      const balanceAfter = await nextBalanceAfter(Payment, tenant._id, {
        direction: 'payment',
        status: 'voided',
        amount: original.amount,
      })

      const voidRow = await Payment.create({
        tenantId: tenant._id,
        leaseId: original.leaseId,
        unitId: original.unitId,
        amount: original.amount,
        currency: 'usd',
        type: 'other',
        status: 'voided',
        direction: 'payment',
        balanceAfter,
        description: `Canceled $${(original.amount / 100).toFixed(2)} of ${original.description ?? original.type}`,
        createdBy: session.user.id,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      })
      voidRows.push(voidRow._id)
      balanceDelta += original.amount
      voidedCount++
    }

    tenant.balance = (tenant.balance ?? 0) - balanceDelta
    await tenant.save()

    return NextResponse.json({
      success: true,
      data: {
        voidedCount,
        balance: tenant.balance,
        voidRowIds: voidRows.map(String),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
