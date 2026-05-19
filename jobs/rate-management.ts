import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import RateChange from '@/models/RateChange'
import { getSettings } from '@/lib/getSettings'
import { formatMoney } from '@/lib/utils'
import {
  calcOccupancyByType,
  suggestRentalPriceChanges,
  suggestUnitTypePriceChanges,
  type LeaseFixture,
  type RentalSuggestion,
  type UnitTypeSuggestion,
} from '@/lib/rateManagement'
import type { IUnitDocument } from '@/models/Unit'

export interface RateChangeProposal {
  tenantId: string
  tenantEmail: string
  tenantName: string
  leaseId: string
  unitId: string
  unitNumber: string
  unitType: string
  currentRate: number
  proposedRate: number
  increaseAmount: number
  increasePercent: number
  tenureMonths: number
  occupancyRate: number
  effectiveDate: Date
  notificationCreated: boolean
}

/**
 * Compute the median price for each unit type from the live Unit collection.
 * Used as the representative "street rate" both for street-rate suggestions
 * and the cap on rental suggestions when allowExceedingStreetRate is false.
 */
function medianPriceByType(units: IUnitDocument[]): Record<string, number> {
  const grouped: Record<string, number[]> = {}
  for (const u of units) {
    if (!grouped[u.type]) grouped[u.type] = []
    grouped[u.type].push(u.price)
  }
  const out: Record<string, number> = {}
  for (const [type, prices] of Object.entries(grouped)) {
    if (prices.length === 0) continue
    const sorted = [...prices].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    out[type] = sorted.length % 2 === 1
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  }
  return out
}

/**
 * Rate Management cron — rule-driven, never auto-applies.
 *
 * For RENTAL rules it persists a `proposed` RateChange row per matching lease
 * so the Summary page can list them across cron runs without re-querying every
 * eligible lease.
 *
 * For UNIT TYPE rules it returns the suggestion list inline; the Summary page
 * recomputes those on demand because nothing else depends on persistence.
 *
 * Returns `null` when Rate Management is disabled in Settings, mirroring the
 * Storable behavior where the entire module sits dormant until the admin opts
 * in.
 */
export async function runRateManagement(): Promise<{
  rentalSuggestions: RentalSuggestion[]
  unitTypeSuggestions: UnitTypeSuggestion[]
  proposals: RateChangeProposal[]
} | null> {
  console.log('[RateManagement] Starting suggestion job…')
  await connectDB()

  const settings = await getSettings()
  if (!settings.rateManagementEnabled) {
    console.log('[RateManagement] Disabled in Settings — skipping run.')
    return null
  }

  const unitTypeRules = settings.unitTypePriceRules ?? []
  const rentalRules = settings.rentalPriceRules ?? []
  const globals = {
    advanceNoticeDays: settings.rentalPriceAdvanceNoticeDays ?? 30,
    allowExceedingStreetRate: !!settings.rentalPriceAllowExceedingStreetRate,
    roundToNearestDollar: settings.rentalPriceRoundToNearestDollar !== false,
  }

  const units = (await Unit.find()) as IUnitDocument[]
  const occupancy = calcOccupancyByType(units.map((u) => ({ type: u.type, status: u.status })))
  const streetRates = medianPriceByType(units)

  const unitTypeSuggestions = suggestUnitTypePriceChanges({
    rules: unitTypeRules,
    occupancy,
    currentStreetRateByType: streetRates,
  })

  const activeLeases = await Lease.find({ status: 'active' }).lean()

  const unitTypeByUnitId: Record<string, string> = {}
  for (const u of units) unitTypeByUnitId[String(u._id)] = u.type

  const leaseFixtures: LeaseFixture[] = activeLeases.map((l: any) => ({
    _id: String(l._id),
    unitId: String(l.unitId),
    tenantId: String(l.tenantId),
    monthlyRate: l.monthlyRate,
    startDate: new Date(l.startDate),
    lastRateChangeDate: l.lastRateChangeDate ? new Date(l.lastRateChangeDate) : undefined,
    status: l.status,
    exemptFromRateManagement: !!l.exemptFromRateManagement,
  }))

  const now = new Date()
  const rentalSuggestions = suggestRentalPriceChanges(leaseFixtures, {
    rules: rentalRules,
    globals,
    unitTypeByUnitId,
    streetRateByUnitType: streetRates,
    now,
  })

  console.log(`[RateManagement] ${unitTypeSuggestions.length} unit-type suggestion(s), ${rentalSuggestions.length} rental suggestion(s)`)

  // Persist rental suggestions as 'proposed' RateChange rows so the Summary
  // page has a stable list across cron runs. Skip when an open proposal/
  // approval already exists for the same lease.
  const proposals: RateChangeProposal[] = []
  for (const s of rentalSuggestions) {
    try {
      const existing = await RateChange.findOne({
        leaseId: s.leaseId,
        status: { $in: ['proposed', 'approved'] },
      })
      if (existing) continue

      const tenant = await Tenant.findById(s.tenantId)
      const unit = units.find((u) => String(u._id) === s.unitId)
      if (!tenant || !unit) continue

      const change = await RateChange.create({
        tenantId: s.tenantId,
        leaseId: s.leaseId,
        unitId: s.unitId,
        currentRate: s.currentRate,
        proposedRate: s.suggestedRate,
        effectiveDate: s.changeDate,
        status: 'proposed',
        occupancyRate: occupancy[s.unitType]?.rate,
        tenureMonths: s.monthsSinceLastChange,
      })

      proposals.push({
        tenantId: String(tenant._id),
        tenantEmail: tenant.email,
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        leaseId: s.leaseId,
        unitId: s.unitId,
        unitNumber: unit.unitNumber,
        unitType: unit.type,
        currentRate: s.currentRate,
        proposedRate: s.suggestedRate,
        increaseAmount: s.increaseAmount,
        increasePercent: (s.increaseAmount / s.currentRate) * 100,
        tenureMonths: s.monthsSinceLastChange,
        occupancyRate: occupancy[s.unitType]?.rate ?? 0,
        effectiveDate: s.changeDate,
        notificationCreated: true,
      })

      console.log(`[RateManagement] Proposed for ${tenant.email}: ${formatMoney(s.currentRate)} → ${formatMoney(s.suggestedRate)} (rate-change id ${change._id})`)
    } catch (err: any) {
      console.error(`[RateManagement] Persist failed for lease ${s.leaseId}:`, err.message)
    }
  }

  return { rentalSuggestions, unitTypeSuggestions, proposals }
}
