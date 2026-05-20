import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import InventoryAdjustment from '@/models/InventoryAdjustment'
import { canFulfillSale, saleDelta, UNLIMITED_INVENTORY } from '@/lib/inventory'

const sellSchema = z.object({
  productId: z.string().min(1),
  tenantId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
})

// POST /api/products/sell — charge a product to a tenant
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = sellSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
    }

    const { productId, tenantId, quantity } = parsed.data

    await connectDB()

    const [product, tenant] = await Promise.all([
      Product.findById(productId),
      Tenant.findById(tenantId),
    ])

    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
    if (!tenant) return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    if (!product.active) return NextResponse.json({ success: false, error: 'Product is inactive' }, { status: 400 })

    // Check inventory
    if (!canFulfillSale(product.inventory, quantity)) {
      return NextResponse.json({ success: false, error: `Insufficient inventory (${product.inventory} remaining)` }, { status: 400 })
    }

    // Calculate total with tax
    const subtotal = product.price * quantity
    const tax = Math.round(subtotal * (product.taxRate / 100))
    const total = subtotal + tax

    // Find active lease for the tenant (needed for payment record)
    const lease = await Lease.findOne({ tenantId, status: { $in: ['active', 'pending_moveout'] } })

    // Create a payment record for the retail sale
    const now = new Date()
    const stripePaymentIntentId = `retail_${Date.now()}_${tenant._id}`

    const payment = await Payment.create({
      tenantId: tenant._id,
      leaseId: lease?._id ?? tenant._id, // fallback if no active lease
      unitId: lease?.unitId ?? tenant._id,
      stripePaymentIntentId,
      amount: total,
      currency: 'usd',
      type: 'other',
      status: 'succeeded',
      periodStart: now,
      periodEnd: now,
      attemptCount: 1,
      lastAttemptAt: now,
    })

    // Decrement inventory + record sale in the ledger so the Retail Inventory
    // Summary can reconstruct stock over a date range.
    let inventoryAfter = product.inventory
    if (product.inventory !== UNLIMITED_INVENTORY) {
      product.inventory -= quantity
      inventoryAfter = product.inventory
      await product.save()
    }

    await InventoryAdjustment.create({
      productId: product._id,
      action: 'sale',
      quantity: saleDelta(quantity),
      reason: `Sold to ${tenant.firstName} ${tenant.lastName}`.trim(),
      inventoryAfter,
      tenantId: tenant._id,
      paymentId: payment._id,
      createdBy: session.user.name ?? session.user.email ?? 'admin',
    })

    return NextResponse.json({
      success: true,
      data: {
        payment,
        product: { name: product.name, price: product.price, quantity, subtotal, tax, total },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
