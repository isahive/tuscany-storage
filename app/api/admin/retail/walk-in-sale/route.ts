import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Product from '@/models/Product'
import Payment from '@/models/Payment'
import InventoryAdjustment from '@/models/InventoryAdjustment'
import { canFulfillSale, saleDelta, UNLIMITED_INVENTORY } from '@/lib/inventory'

const schema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1),
  })).min(1),
  paymentMethod: z.enum(['cash', 'card', 'check', 'other']).default('cash'),
  note: z.string().max(500).optional(),
})

// POST /api/admin/retail/walk-in-sale
// Storable's walk-in flow: a non-tenant customer buys retail items at the
// counter. We record the sale against the singleton synthetic "Retail
// Walk-In" tenant so the rest of the billing system doesn't need a special
// case. Stock decrements per-item and a single Payment row captures the
// transaction (marked 'succeeded' since the admin already collected cash).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    await connectDB()

    // Ensure the synthetic tenant exists.
    let walkIn = await Tenant.findOne({ isRetailWalkIn: true })
    if (!walkIn) {
      walkIn = await Tenant.create({
        firstName: 'Retail',
        lastName: 'Walk-In',
        email: 'retail-walk-in@internal.tuscanystorage',
        phone: '0000000000',
        password: await bcrypt.hash(`walkin-${Date.now()}`, 12),
        role: 'tenant',
        status: 'active',
        loginDisabled: true,
        isRetailWalkIn: true,
      })
    }

    // Load products + stock-check the whole basket up-front so we don't
    // partially commit when one item is out.
    const products = await Promise.all(
      parsed.data.items.map(async (i) => {
        const p = await Product.findById(i.productId)
        return p ? { product: p, quantity: i.quantity } : null
      }),
    )
    if (products.some((p) => !p)) {
      return NextResponse.json({ success: false, error: 'One or more products not found.' }, { status: 404 })
    }
    for (const row of products) {
      if (!canFulfillSale(row!.product.inventory, row!.quantity)) {
        return NextResponse.json(
          { success: false, error: `Insufficient inventory for ${row!.product.name} (${row!.product.inventory} remaining).` },
          { status: 409 },
        )
      }
    }

    let subtotal = 0
    let tax = 0
    for (const row of products) {
      const sub = row!.product.price * row!.quantity
      subtotal += sub
      tax += Math.round(sub * (row!.product.taxRate / 100))
    }
    const total = subtotal + tax

    const now = new Date()
    const payment = await Payment.create({
      tenantId: walkIn._id,
      // No lease/unit on a walk-in — repurpose the walkIn _id as a sentinel
      // so the Payment schema requireds still satisfy.
      leaseId: walkIn._id,
      unitId: walkIn._id,
      stripePaymentIntentId: `walkin_${Date.now()}_${session.user.id}`,
      amount: total,
      currency: 'usd',
      type: 'other',
      status: 'succeeded',
      direction: 'payment',
      periodStart: now,
      periodEnd: now,
      attemptCount: 1,
      lastAttemptAt: now,
      description: `Retail walk-in (${parsed.data.paymentMethod})${parsed.data.note ? ` — ${parsed.data.note}` : ''}`,
      createdBy: session.user.id,
    })

    // Decrement stock + ledger row per product.
    for (const row of products) {
      const { product, quantity } = row!
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
        reason: `Walk-in sale (${parsed.data.paymentMethod})`,
        inventoryAfter,
        tenantId: walkIn._id,
        paymentId: payment._id,
        createdBy: session.user.name ?? session.user.email ?? 'admin',
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentId: String(payment._id),
        subtotal, tax, total,
        items: products.map((r) => ({
          productId: String(r!.product._id),
          name: r!.product.name,
          quantity: r!.quantity,
          price: r!.product.price,
        })),
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
