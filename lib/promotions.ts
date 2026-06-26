/**
 * Pure helpers for Storable Easy's Promotions module — kept free of mongoose
 * so they can be exercised by vitest against fixtures. The CRUD routes and
 * application logic call into these for consistent rules.
 */

export interface PromotionLike {
  method: 'manual' | 'promo_code' | 'automatic'
  promoCode?: string
  status: 'active' | 'retired'
  startDate: Date | string
  endDate?: Date | string | null
  noExpiration: boolean
  appliedCount: number
  unitTypes: string[]
  allUnitTypes?: boolean
}

// ─── Expiry / activeness ─────────────────────────────────────────────────────

/** True when the promotion is in its date window and not retired. */
export function isPromotionAvailable(p: PromotionLike, now: Date = new Date()): boolean {
  if (p.status !== 'active') return false
  const start = new Date(p.startDate)
  if (start > now) return false
  if (!p.noExpiration && p.endDate) {
    const end = new Date(p.endDate)
    if (end < now) return false
  }
  return true
}

/** True iff endDate is non-null and in the past. Independent of status —
 *  Storable shows the "Expired" tag even on retired promos that ran past. */
export function isPromotionExpired(p: PromotionLike, now: Date = new Date()): boolean {
  if (p.noExpiration) return false
  if (!p.endDate) return false
  return new Date(p.endDate) < now
}

// ─── Lock detection ──────────────────────────────────────────────────────────

/**
 * Fields that may be edited after the promotion has been applied to at least
 * one rental. Storable's restrictions:
 *   - name, description           — always editable
 *   - endDate                     — always editable
 *   - unitTypes                   — adds always allowed, removals only if no
 *                                   rental of that type holds this promo
 *   - method                      — never editable after creation
 *   - discountType / discountValue / startDate / beginsImmediately /
 *     beginsAfterCycles / noExpiration / durationCycles / promoCode
 *                                 — locked once applied
 */
export const ALWAYS_EDITABLE = ['name', 'description', 'endDate'] as const
export const LOCKED_AFTER_APPLY = [
  'method',
  'discountType',
  'discountValue',
  'startDate',
  'beginsImmediately',
  'beginsAfterCycles',
  'noExpiration',
  'durationCycles',
  'promoCode',
] as const

export function isPromotionLocked(p: { appliedCount: number }): boolean {
  return p.appliedCount > 0
}

/** Returns the list of field names from `patch` that aren't allowed given the
 *  current lock state. Empty array = the edit is fine. */
export function disallowedEditFields(
  current: { appliedCount: number },
  patch: Record<string, unknown>,
): string[] {
  // Method is always locked after creation, irrespective of appliedCount.
  const lockedAlways: string[] = ['method']
  if (!isPromotionLocked(current)) {
    return Object.keys(patch).filter((k) => lockedAlways.includes(k))
  }
  const locked = new Set<string>([...lockedAlways, ...LOCKED_AFTER_APPLY])
  return Object.keys(patch).filter((k) => locked.has(k))
}

// ─── Unit type exclusivity ───────────────────────────────────────────────────

/**
 * Storable: a unit type can be on multiple manual promotions, but only one of
 * { promo_code, automatic } per type. Returns the list of unit types in
 * `proposed` that conflict with an existing exclusive promo in `existing`.
 *
 * Pass `excludeId` when editing — so the promo doesn't conflict with itself.
 */
export function unitTypeExclusivityConflict(args: {
  proposed: { id?: string; method: 'manual' | 'promo_code' | 'automatic'; unitTypes: string[]; allUnitTypes?: boolean; status?: 'active' | 'retired' }
  existing: Array<{ _id: string; method: 'manual' | 'promo_code' | 'automatic'; unitTypes: string[]; allUnitTypes?: boolean; status: 'active' | 'retired' }>
}): string[] {
  const { proposed, existing } = args
  if (proposed.method === 'manual') return [] // manual stacks freely

  const proposedTypes = proposed.allUnitTypes ? new Set(['__ALL__']) : new Set(proposed.unitTypes)

  const conflicts: string[] = []
  for (const e of existing) {
    if (e._id === proposed.id) continue
    if (e.status !== 'active') continue
    if (e.method === 'manual') continue
    // promo_code conflicts with automatic (and vice versa) on overlapping types
    if (e.method === proposed.method) continue
    const eTypes = e.allUnitTypes ? new Set(['__ALL__']) : new Set(e.unitTypes)
    // If either side is "allUnitTypes", every type collides.
    if (eTypes.has('__ALL__') || proposedTypes.has('__ALL__')) {
      conflicts.push(...(proposed.allUnitTypes ? e.unitTypes : proposed.unitTypes))
      continue
    }
    for (const t of proposedTypes) {
      if (eTypes.has(t)) conflicts.push(t)
    }
  }
  // de-dupe
  return [...new Set(conflicts)]
}

// ─── Promo code lookup ───────────────────────────────────────────────────────

/** Normalize a promo code for case-insensitive comparison. */
export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase()
}

/**
 * Find an available promo_code-method promotion matching the entered code,
 * given a list candidates already loaded from the DB. Pulled out as a pure
 * function so the route can be tested without a live DB.
 */
export function findPromoCodeMatch(
  enteredCode: string,
  candidates: PromotionLike[],
  unitType?: string,
  now: Date = new Date(),
): PromotionLike | null {
  const target = normalizePromoCode(enteredCode)
  if (!target) return null
  for (const c of candidates) {
    if (c.method !== 'promo_code') continue
    if (!isPromotionAvailable(c, now)) continue
    if (normalizePromoCode(c.promoCode ?? '') !== target) continue
    if (unitType && !c.allUnitTypes && !c.unitTypes.includes(unitType)) continue
    return c
  }
  return null
}

/**
 * Find the active `automatic`-method promotion that applies to a unit type.
 * These are auto-applied on the public rent flow (no code entry) — the move-in
 * special is configured this way. Storable's exclusivity rule guarantees at
 * most one automatic promo per unit type, so the first available match wins.
 */
export function findAutomaticPromo(
  candidates: PromotionLike[],
  unitType?: string,
  now: Date = new Date(),
): PromotionLike | null {
  for (const c of candidates) {
    if (c.method !== 'automatic') continue
    if (!isPromotionAvailable(c, now)) continue
    if (unitType && !c.allUnitTypes && !c.unitTypes.includes(unitType)) continue
    return c
  }
  return null
}

// ─── Validation helpers ──────────────────────────────────────────────────────

/** Storable rule: endDate must be at least one day after startDate. */
export function validateDateWindow(
  startDate: Date | string,
  endDate: Date | string | null | undefined,
): { ok: boolean; reason?: string } {
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return { ok: false, reason: 'invalid_start' }
  if (!endDate) return { ok: true }
  const end = new Date(endDate)
  if (Number.isNaN(end.getTime())) return { ok: false, reason: 'invalid_end' }
  const oneDayMs = 24 * 60 * 60 * 1000
  if (end.getTime() - start.getTime() < oneDayMs) {
    return { ok: false, reason: 'end_must_be_after_start' }
  }
  return { ok: true }
}
