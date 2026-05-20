import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'
import InventoryAdjustment from '@/models/InventoryAdjustment'
import {
  applyDelta,
  normalizeAdjustmentQuantity,
  UNLIMITED_INVENTORY,
} from '@/lib/inventory'

const schema = z.object({
  action: z.enum(['received', 'adjustment']),
  quantity: z.number().int(), // signed when action='adjustment', positive when 'received'
  reason: z.string().max(500).optional(),
})

// POST /api/admin/products/[id]/adjust-inventory
// Storable "Change Inventory" form. Writes an append-only audit row to
// InventoryAdjustment and updates the denormalized Product.inventory.
// Refuses to drive stock below zero.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

    const check = normalizeAdjustmentQuantity(parsed.data.action, parsed.data.quantity)
    if (!check.ok) {
      const msg = {
        quantity_not_integer: 'Quantity must be a whole number.',
        received_must_be_positive: 'Received quantity must be a positive number.',
        adjustment_cannot_be_zero: 'Adjustment cannot be zero — type a signed number (e.g. -3 to remove).',
      }[check.reason] ?? 'Invalid quantity.'
      return NextResponse.json({ success: false, error: msg }, { status: 400 })
    }

    await connectDB()

    const product = await Product.findById(params.id)
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })

    const delta = check.quantity
    const next = applyDelta(product.inventory, delta)
    if (next === null) {
      return NextResponse.json(
        { success: false, error: `Cannot reduce stock below zero (current: ${product.inventory}).` },
        { status: 409 },
      )
    }

    if (product.inventory !== UNLIMITED_INVENTORY) {
      product.inventory = next
      await product.save()
    }

    const row = await InventoryAdjustment.create({
      productId: product._id,
      action: parsed.data.action,
      quantity: delta,
      reason: parsed.data.reason ?? '',
      inventoryAfter: next,
      createdBy: session.user.name ?? session.user.email ?? 'admin',
    })

    return NextResponse.json({ success: true, data: { adjustmentId: String(row._id), inventoryAfter: next } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
