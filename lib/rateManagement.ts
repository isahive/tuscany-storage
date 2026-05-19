/**
 * Pure logic for Storable Easy's Rate Management — kept free of mongoose so
 * we can unit-test against fixtures. The `jobs/rate-management.ts` worker is
 * the thin IO wrapper that loads Settings + Units + Leases and feeds them
 * into these helpers.
 *
 * Storable defines two rule types:
 *
 *   A) Unit Type Price Change rules — suggest STREET-RATE updates when a
 *      unit type's occupancy meets/exceeds a threshold.
 *   B) Rental Price Change rules — suggest updates to EXISTING tenants when
 *      a configurable number of months has passed since their last change.
 *
 * Rules never auto-apply; they produce suggestions for the Summary page.
 */

export interface UnitTypePriceRule {
  id: string
  unitType: string
  increaseAmount?: number      // cents — set ONE of amount/percent
  increasePercent?: number     // 0–100
  minOccupancyPct: number      // 0–100
  roundingRule: 'none' | 'nearest_dollar'
}

export interface RentalPriceRule {
  id: string
  unitType: string
  increaseAmount?: number
  increasePercent?: number
  minMonthsSinceLastChange: number
}

export interface RentalGlobalOptions {
  advanceNoticeDays: number
  allowExceedingStreetRate: boolean
  roundToNearestDollar: boolean
}

export interface OccupancyByType {
  [unitType: string]: { total: number; occupied: number; rate: number }
}

export interface LeaseFixture {
  _id: string
  unitId: string
  tenantId: string
  monthlyRate: number          // cents
  startDate: Date
  lastRateChangeDate?: Date
  status: 'active' | 'ended' | 'pending_moveout'
  exemptFromRateManagement?: boolean
}

export interface UnitTypeSuggestion {
  rule: UnitTypePriceRule
  unitType: string
  currentStreetRate: number    // best-effort: median active monthly rate for the unit type
  suggestedStreetRate: number
  increaseAmount: number
  occupancyRate: number
}

export interface RentalSuggestion {
  rule: RentalPriceRule
  leaseId: string
  tenantId: string
  unitId: string
  unitType: string
  currentRate: number
  suggestedRate: number
  increaseAmount: number
  monthsSinceLastChange: number
  notificationDate: Date       // change date - advance notice
  changeDate: Date             // effective date the rate flips
}

// ─── Rounding ────────────────────────────────────────────────────────────────

export function roundToNearestDollar(cents: number): number {
  // Round to the nearest 100¢ (Math.round is half-away-from-zero in JS).
  return Math.round(cents / 100) * 100
}

export function applyRounding(
  cents: number,
  rule: 'none' | 'nearest_dollar',
): number {
  if (rule === 'nearest_dollar') return roundToNearestDollar(cents)
  return Math.round(cents)
}

// ─── Increase math ───────────────────────────────────────────────────────────

/**
 * Compute the new rate given a base + either an absolute or percent increase.
 * Percent wins if both are set (matches Storable's UI which only ever submits
 * one of the two, but be deterministic).
 */
export function computeNewRate(
  base: number,
  args: { increaseAmount?: number; increasePercent?: number },
): number {
  if (args.increasePercent !== undefined) {
    return base + (base * args.increasePercent) / 100
  }
  if (args.increaseAmount !== undefined) {
    return base + args.increaseAmount
  }
  return base
}

// ─── Occupancy ───────────────────────────────────────────────────────────────

export function calcOccupancyByType(
  units: Array<{ type: string; status: string }>,
): OccupancyByType {
  const acc: OccupancyByType = {}
  for (const u of units) {
    if (!acc[u.type]) acc[u.type] = { total: 0, occupied: 0, rate: 0 }
    acc[u.type].total++
    if (u.status === 'occupied') acc[u.type].occupied++
  }
  for (const k of Object.keys(acc)) {
    const d = acc[k]
    d.rate = d.total > 0 ? (d.occupied / d.total) * 100 : 0
  }
  return acc
}

// ─── Time ────────────────────────────────────────────────────────────────────

export function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

// ─── Rule A: Unit Type suggestions ───────────────────────────────────────────

/**
 * Produce one suggestion per Unit Type Price rule whose minOccupancyPct is
 * met. Caller provides current street-rate per unit type (we don't track it
 * here — pull from a UnitTypePrice model or representative lease).
 */
export function suggestUnitTypePriceChanges(args: {
  rules: UnitTypePriceRule[]
  occupancy: OccupancyByType
  currentStreetRateByType: Record<string, number>
}): UnitTypeSuggestion[] {
  const out: UnitTypeSuggestion[] = []
  for (const rule of args.rules) {
    const occ = args.occupancy[rule.unitType]
    if (!occ) continue
    if (occ.rate < rule.minOccupancyPct) continue

    const current = args.currentStreetRateByType[rule.unitType]
    if (typeof current !== 'number' || current <= 0) continue

    const raw = computeNewRate(current, rule)
    const suggested = applyRounding(raw, rule.roundingRule)
    out.push({
      rule,
      unitType: rule.unitType,
      currentStreetRate: current,
      suggestedStreetRate: suggested,
      increaseAmount: suggested - current,
      occupancyRate: occ.rate,
    })
  }
  return out
}

// ─── Rule B: Rental suggestions ──────────────────────────────────────────────

export interface RentalSuggestionContext {
  rules: RentalPriceRule[]
  globals: RentalGlobalOptions
  /** Map unit id → its unit type label (so we don't pass full unit docs). */
  unitTypeByUnitId: Record<string, string>
  /** Optional street rate per unit type — used to cap suggestions when
   *  globals.allowExceedingStreetRate is false. */
  streetRateByUnitType?: Record<string, number>
  now: Date
}

/**
 * Compute rental suggestions across the given leases. Skips:
 *   - exempt leases (Storable per-rental flag)
 *   - leases whose months-since-last-change is below the rule threshold
 *   - leases whose unit type has no matching rental rule
 */
export function suggestRentalPriceChanges(
  leases: LeaseFixture[],
  ctx: RentalSuggestionContext,
): RentalSuggestion[] {
  const out: RentalSuggestion[] = []
  const ruleByType = new Map(ctx.rules.map((r) => [r.unitType, r]))

  for (const lease of leases) {
    if (lease.status !== 'active') continue
    if (lease.exemptFromRateManagement) continue

    const unitType = ctx.unitTypeByUnitId[lease.unitId]
    if (!unitType) continue
    const rule = ruleByType.get(unitType)
    if (!rule) continue

    const reference = lease.lastRateChangeDate ?? lease.startDate
    const monthsSince = monthsBetween(reference, ctx.now)
    if (monthsSince < rule.minMonthsSinceLastChange) continue

    let raw = computeNewRate(lease.monthlyRate, rule)
    if (ctx.globals.roundToNearestDollar) raw = roundToNearestDollar(raw)
    else raw = Math.round(raw)

    // Storable: optionally cap at the street rate so a rental never exceeds it.
    if (!ctx.globals.allowExceedingStreetRate && ctx.streetRateByUnitType) {
      const street = ctx.streetRateByUnitType[unitType]
      if (typeof street === 'number' && street > 0 && raw > street) {
        raw = ctx.globals.roundToNearestDollar ? roundToNearestDollar(street) : street
      }
    }

    // Don't propose a no-op or a decrease — defensive against bad rule data.
    if (raw <= lease.monthlyRate) continue

    const changeDate = new Date(ctx.now)
    changeDate.setDate(changeDate.getDate() + ctx.globals.advanceNoticeDays)
    const notificationDate = new Date(ctx.now)

    out.push({
      rule,
      leaseId: lease._id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      unitType,
      currentRate: lease.monthlyRate,
      suggestedRate: raw,
      increaseAmount: raw - lease.monthlyRate,
      monthsSinceLastChange: monthsSince,
      notificationDate,
      changeDate,
    })
  }
  return out
}

// ─── Reminder ────────────────────────────────────────────────────────────────

/**
 * Does today fall on the configured reminder day? Day clamps to the actual
 * end-of-month so reminderDay=28 still fires in February etc.
 */
export function isReminderDay(
  today: Date,
  reminderDay: number,
): boolean {
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const effectiveDay = Math.min(reminderDay, lastDayOfMonth)
  return today.getDate() === effectiveDay
}
