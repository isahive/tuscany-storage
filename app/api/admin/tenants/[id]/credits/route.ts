import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Payment from '@/models/Payment'
import { nextBalanceAfter } from '@/lib/paymentBalance'

interface RouteContext {
  params: Promise<{ id: string }>
}

const schema = z.object({
  /** Credit amount in cents (positive). */
  amount: z.number().int().positive(),
  description: z.string().optional(),
})

/**
 * POST /api/admin/tenants/[id]/credits
 * Records a credit on the tenant's account:
 *   - Creates a Payment row with type='credit', status='succeeded'
 *   - Decrements tenant.balance by the credit amount
 *
 * Positive balance = tenant owes. Negative balance = available credit.
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
    })

    // Reduce outstanding balance (positive balance) by the credit amount.
    tenant.balance = (tenant.balance ?? 0) - amount
    await tenant.save()

    return NextResponse.json({
      success: true,
      data: {
        creditId: String(credit._id),
        balance: tenant.balance,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
