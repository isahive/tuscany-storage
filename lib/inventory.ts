/**
 * Pure helpers for Storable Easy's Retail Sale inventory adjustments.
 *
 * The DB-bound logic lives in app/api/admin/products/[id]/adjust-inventory —
 * these helpers express the rules (sign per action, stock-out detection,
 * unlimited inventory handling) so they can be unit-tested in isolation.
 */

export type InventoryAction = 'received' | 'adjustment' | 'sale'

/** -1 is Storable's "unlimited stock" sentinel — never decrement it. */
export const UNLIMITED_INVENTORY = -1

/**
 * Storable surfaces "Received" and "Adjustment" as the two admin-facing
 * change types. Sales are computed automatically and never selectable from
 * the Change Inventory form, so they live as a separate action only the
 * server writes.
 *
 * Received: admin types a positive count of newly arrived stock. Negative
 *           values are not allowed (use Adjustment to remove stock).
 * Adjustment: admin types a SIGNED quantity. Negative removes stock,
 *             positive adds (e.g. correcting a count after physical audit).
 */
export function normalizeAdjustmentQuantity(
  action: 'received' | 'adjustment',
  raw: number,
): { ok: true; quantity: number } | { ok: false; reason: string } {
  if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
    return { ok: false, reason: 'quantity_not_integer' }
  }
  if (action === 'received') {
    if (raw <= 0) return { ok: false, reason: 'received_must_be_positive' }
    return { ok: true, quantity: raw }
  }
  // adjustment
  if (raw === 0) return { ok: false, reason: 'adjustment_cannot_be_zero' }
  return { ok: true, quantity: raw }
}

/**
 * Compute what `Product.inventory` should become after applying this signed
 * quantity. Returns `null` when the change would push stock below zero — the
 * caller should refuse the operation in that case.
 *
 * Unlimited stock (-1) passes through unchanged so the calling endpoint can
 * still write a ledger row for audit purposes if it wants.
 */
export function applyDelta(
  currentInventory: number,
  delta: number,
): number | null {
  if (currentInventory === UNLIMITED_INVENTORY) return UNLIMITED_INVENTORY
  const next = currentInventory + delta
  if (next < 0) return null
  return next
}

/** True iff a sale of `quantity` units is allowed against current stock. */
export function canFulfillSale(currentInventory: number, quantity: number): boolean {
  if (quantity <= 0) return false
  if (currentInventory === UNLIMITED_INVENTORY) return true
  return currentInventory >= quantity
}

/** Convenience — turns a sale quantity (positive) into the signed delta the
 *  ledger stores. */
export function saleDelta(quantity: number): number {
  return -Math.abs(quantity)
}
