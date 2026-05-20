import { describe, it, expect } from 'vitest'
import {
  normalizeAdjustmentQuantity,
  applyDelta,
  canFulfillSale,
  saleDelta,
  UNLIMITED_INVENTORY,
} from './inventory'

describe('normalizeAdjustmentQuantity', () => {
  it('rejects non-integers', () => {
    expect(normalizeAdjustmentQuantity('received', 1.5 as any).ok).toBe(false)
  })
  it('rejects zero adjustments', () => {
    expect(normalizeAdjustmentQuantity('adjustment', 0).ok).toBe(false)
  })
  it('rejects non-positive received quantities', () => {
    expect(normalizeAdjustmentQuantity('received', -1).ok).toBe(false)
    expect(normalizeAdjustmentQuantity('received', 0).ok).toBe(false)
  })
  it('accepts positive received', () => {
    expect(normalizeAdjustmentQuantity('received', 5)).toEqual({ ok: true, quantity: 5 })
  })
  it('accepts signed adjustment', () => {
    expect(normalizeAdjustmentQuantity('adjustment', -3)).toEqual({ ok: true, quantity: -3 })
    expect(normalizeAdjustmentQuantity('adjustment', 7)).toEqual({ ok: true, quantity: 7 })
  })
})

describe('applyDelta', () => {
  it('adds for positive delta', () => {
    expect(applyDelta(10, 5)).toBe(15)
  })
  it('subtracts for negative delta', () => {
    expect(applyDelta(10, -3)).toBe(7)
  })
  it('returns null when it would go negative', () => {
    expect(applyDelta(2, -3)).toBeNull()
  })
  it('allows exact zero', () => {
    expect(applyDelta(3, -3)).toBe(0)
  })
  it('passes through unlimited stock', () => {
    expect(applyDelta(UNLIMITED_INVENTORY, -100)).toBe(UNLIMITED_INVENTORY)
    expect(applyDelta(UNLIMITED_INVENTORY, 50)).toBe(UNLIMITED_INVENTORY)
  })
})

describe('canFulfillSale', () => {
  it('rejects zero or negative quantity', () => {
    expect(canFulfillSale(10, 0)).toBe(false)
    expect(canFulfillSale(10, -1)).toBe(false)
  })
  it('allows when stock >= quantity', () => {
    expect(canFulfillSale(5, 5)).toBe(true)
    expect(canFulfillSale(10, 3)).toBe(true)
  })
  it('rejects when stock < quantity', () => {
    expect(canFulfillSale(2, 5)).toBe(false)
  })
  it('always allows unlimited stock', () => {
    expect(canFulfillSale(UNLIMITED_INVENTORY, 9999)).toBe(true)
  })
})

describe('saleDelta', () => {
  it('returns the negative absolute', () => {
    expect(saleDelta(3)).toBe(-3)
    expect(saleDelta(-3)).toBe(-3)
  })
})
