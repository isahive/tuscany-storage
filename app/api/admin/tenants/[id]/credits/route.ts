import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { Types } from 'mongoose'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Payment from '@/models/Payment'
import { nextBalanceAfter } from '@/lib/paymentBalance'
import { syncTenantStatusFromBalance } from '@/lib/tenantStatus'

interface RouteContext {
  params: Promise<{ id: string }>
}

const schema = z.object({
  /** Credit amount in cents (positive). */
  amount: z.number().int().positive(),
  description: z.string().optional(),
})

/** Same shape the outstanding endpoint uses to enumerate pending line items —
 *  kept identical so the credit application covers exactly what the UI lists. */
const PENDING_ITEM_TYPES = ['rent', 'late_fee', 'deposit', 'prorated', 'other'] as const

/**
 * POST /api/admin/tenants/[id]/credits
 * Records a credit on the tenant's account. Applies it FIFO against pending
 * charge line items (oldest first), settling each item it fully covers. Any
 * leftover stays as credit on account (negative tenant.balance).
 *
 *   - Settled items flip from status='pending' → 'succeeded' and are linked
 *     back to the credit row via `appliedToItemIds`.
 *   - tenant.balance is decremented by the full credit amount regardless of
 *     how much landed on items vs. residual — the ledger math (charges +
 *     payments) keeps the books even either way.
 *
 * Why FIFO: matches how Storable Easy applies credits, gives the simplest
 * audit trail, and avoids surprises ("why did my newest invoice clear before
 * the oldest one?").
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

    const { amount, description } = parsed.data

    // FIFO walk of pending charges. Mirror the outstanding endpoint's filter
    // so the credit settles exactly the items the admin sees on screen.
    const pendingItems = await Payment.find({
      tenantId: tenant._id,
      status: 'pending',
      type: { $in: PENDING_ITEM_TYPES as unknown as string[] },
    })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id amount taxRate')
      .lean<Array<{ _id: Types.ObjectId; amount: number; taxRate?: number }>>()

    const settledItemIds: Types.ObjectId[] = []
    let remaining = amount
    for (const item of pendingItems) {
      const itemTotal = item.amount + Math.round(item.amount * ((item.taxRate ?? 0) / 100))
      if (remaining < itemTotal) break
      remaining -= itemTotal
      settledItemIds.push(item._id)
    }

    const balanceAfter = await nextBalanceAfter(Payment, tenant._id, {
      direction: 'payment',
      status: 'succeeded',
      amount,
    })

    const credit = await Payment.create({
      tenantId: tenant._id,
      amount,
      currency: 'usd',
      type: 'credit',
      status: 'succeeded',
      direction: 'payment',
      balanceAfter,
      attemptCount: 1,
      lastAttemptAt: new Date(),
      description: description ?? '',
      createdBy: session.user.id,
      appliedToItemIds: settledItemIds.length > 0 ? settledItemIds : undefined,
    })

    // Flip the settled line items from pending to succeeded so they disappear
    // from the outstanding-items view. Use updateMany for a single round-trip.
    if (settledItemIds.length > 0) {
      await Payment.updateMany(
        { _id: { $in: settledItemIds }, tenantId: tenant._id, status: 'pending' },
        { $set: { status: 'succeeded', lastAttemptAt: new Date() } },
      )
    }

    // Balance decrement is always the FULL credit amount — the ledger sums
    // charges minus payments, so items flipping pending→succeeded leaves the
    // running total unchanged (charges keep counting either way per
    // balanceDelta).
    tenant.balance = (tenant.balance ?? 0) - amount
    syncTenantStatusFromBalance(tenant)
    await tenant.save()

    return NextResponse.json({
      success: true,
      data: {
        creditId: String(credit._id),
        balance: tenant.balance,
        settledItemIds: settledItemIds.map(String),
        residual: remaining,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
