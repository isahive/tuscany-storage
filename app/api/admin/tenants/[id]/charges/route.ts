import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Payment from '@/models/Payment'
import Product from '@/models/Product'
import Settings from '@/models/Settings'
import Lease from '@/models/Lease'
import { nextBalanceAfter } from '@/lib/paymentBalance'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'

interface RouteContext {
  params: Promise<{ id: string }>
}

const schema = z.object({
  kind: z.enum(['fee', 'product']),
  refId: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  // Admin overrides from the Add a Fee / Add a Product modal:
  name: z.string().optional(),
  amount: z.number().int().min(0).optional(),       // in cents, overrides the default
  taxRate: z.number().min(0).max(100).optional(),   // percent
  description: z.string().optional(),
  dueDate: z.string().optional(),                   // ISO string
  autoChargeOnDueDate: z.boolean().optional(),
})

/**
 * POST /api/admin/tenants/[id]/charges
 * Applies a fee or product charge to a tenant's account.
 *   - Creates a Payment row (type='late_fee' for fees, 'other' for products, status='pending')
 *   - Adds the charge amount to tenant.balance
 *   - Decrements product inventory if applicable
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

    const {
      kind, refId, quantity = 1,
      name: nameOverride, amount: amountOverride, taxRate: taxRateOverride,
      description, dueDate, autoChargeOnDueDate,
    } = parsed.data

    await connectDB()
    const tenant = await Tenant.findById(id)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    let amount = 0
    let label = ''
    let type: 'late_fee' | 'other' = 'other'

    if (kind === 'fee') {
      const s = await Settings.findOne({}).lean()
      const fees = ((s?.customFees as any[]) ?? DEFAULT_SETTINGS.customFees) as Array<{
        id: string; name: string; amount: number; active?: boolean
      }>
      const fee = fees.find((f) => f.id === refId)
      if (!fee) {
        return NextResponse.json({ success: false, error: 'Fee not found' }, { status: 404 })
      }
      amount = fee.amount * quantity
      label = fee.name
      type = 'late_fee'
    } else {
      const product = await Product.findById(refId)
      if (!product) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
      }
      if (product.inventory !== -1 && product.inventory < quantity) {
        return NextResponse.json({ success: false, error: 'Insufficient inventory' }, { status: 409 })
      }
      amount = product.price * quantity
      label = `${product.name}${quantity > 1 ? ` × ${quantity}` : ''}`
      type = 'other'

      if (product.inventory !== -1) {
        product.inventory -= quantity
        await product.save()
      }
    }

    // Admin overrides take precedence over defaults
    const finalName = nameOverride?.trim() || label
    const finalAmount = typeof amountOverride === 'number' ? amountOverride : amount
    const taxPct = typeof taxRateOverride === 'number' ? taxRateOverride : 0
    const taxCents = Math.round(finalAmount * (taxPct / 100))
    const totalAmount = finalAmount + taxCents
    const parsedDueDate = dueDate ? new Date(dueDate) : new Date()
    const shouldAutoCharge = autoChargeOnDueDate ?? true

    // Tie the charge to the tenant's active lease if there is one (for billing-history grouping)
    const activeLease = await Lease.findOne({ tenantId: tenant._id, status: 'active' })

    const balanceAfter = await nextBalanceAfter(Payment, tenant._id, {
      direction: 'charge',
      status: 'pending',
      amount: totalAmount,
    })

    const charge = await Payment.create({
      tenantId: tenant._id,
      leaseId: activeLease?._id,
      unitId: activeLease?.unitId,
      amount: totalAmount,
      currency: 'usd',
      type,
      status: 'pending',
      direction: 'charge',
      balanceAfter,
      description: description ? `${finalName} — ${description}` : finalName,
      createdBy: session.user.id,
      attemptCount: 0,
      dueDate: parsedDueDate,
      autoChargeOnDueDate: shouldAutoCharge,
      taxRate: taxPct,
    })

    // Add to outstanding balance
    tenant.balance = (tenant.balance ?? 0) + totalAmount
    await tenant.save()

    return NextResponse.json({
      success: true,
      data: {
        chargeId: String(charge._id),
        amount: totalAmount,
        label: finalName,
        balance: tenant.balance,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
