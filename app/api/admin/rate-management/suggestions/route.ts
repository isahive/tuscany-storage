import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import { getSettings } from '@/lib/getSettings'
import {
  calcOccupancyByType,
  suggestRentalPriceChanges,
  suggestUnitTypePriceChanges,
  type LeaseFixture,
} from '@/lib/rateManagement'

function medianPriceByType(units: Array<{ type: string; price: number }>): Record<string, number> {
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
    out[type] = sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  }
  return out
}

// GET /api/admin/rate-management/suggestions
// Returns the live suggestion snapshot for the Summary page (unit type + rental).
// Recomputed on every call so admins always see fresh occupancy + months-since
// numbers. The rental side does NOT persist anything here — that happens on
// /submit. The cron persists `proposed` RateChange rows separately for the
// audit trail.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()
    const settings = await getSettings()

    if (!settings.rateManagementEnabled) {
      return NextResponse.json({
        success: true,
        data: {
          enabled: false,
          unitTypeSuggestions: [],
          rentalSuggestions: [],
        },
      })
    }

    const unitDocs = await Unit.find().lean<Array<{ _id: any; type: string; status: string; price: number; unitNumber: string }>>()
    const occupancy = calcOccupancyByType(unitDocs.map((u) => ({ type: u.type, status: u.status })))
    const streetRates = medianPriceByType(unitDocs)

    const unitTypeSuggestions = suggestUnitTypePriceChanges({
      rules: settings.unitTypePriceRules ?? [],
      occupancy,
      currentStreetRateByType: streetRates,
    })

    const activeLeases = await Lease.find({ status: 'active' }).lean<Array<any>>()
    const unitTypeByUnitId: Record<string, string> = {}
    for (const u of unitDocs) unitTypeByUnitId[String(u._id)] = u.type

    const leaseFixtures: LeaseFixture[] = activeLeases.map((l) => ({
      _id: String(l._id),
      unitId: String(l.unitId),
      tenantId: String(l.tenantId),
      monthlyRate: l.monthlyRate,
      startDate: new Date(l.startDate),
      lastRateChangeDate: l.lastRateChangeDate ? new Date(l.lastRateChangeDate) : undefined,
      status: l.status,
      exemptFromRateManagement: !!l.exemptFromRateManagement,
    }))

    const rentalSuggestionsRaw = suggestRentalPriceChanges(leaseFixtures, {
      rules: settings.rentalPriceRules ?? [],
      globals: {
        advanceNoticeDays: settings.rentalPriceAdvanceNoticeDays ?? 30,
        allowExceedingStreetRate: !!settings.rentalPriceAllowExceedingStreetRate,
        roundToNearestDollar: settings.rentalPriceRoundToNearestDollar !== false,
      },
      unitTypeByUnitId,
      streetRateByUnitType: streetRates,
      now: new Date(),
    })

    // Hydrate with tenant + unit display fields the Summary page needs.
    const tenantIds = [...new Set(rentalSuggestionsRaw.map((s) => s.tenantId))]
    const tenantDocs = await Tenant.find({ _id: { $in: tenantIds } })
      .select('firstName lastName email')
      .lean<Array<{ _id: any; firstName: string; lastName: string; email: string }>>()
    const tenantById = new Map(tenantDocs.map((t) => [String(t._id), t]))

    const unitById = new Map(unitDocs.map((u) => [String(u._id), u]))

    const rentalSuggestions = rentalSuggestionsRaw.map((s) => ({
      ...s,
      tenantName: tenantById.get(s.tenantId)
        ? `${tenantById.get(s.tenantId)!.firstName} ${tenantById.get(s.tenantId)!.lastName}`
        : '—',
      tenantEmail: tenantById.get(s.tenantId)?.email ?? '',
      unitNumber: unitById.get(s.unitId)?.unitNumber ?? '—',
    }))

    return NextResponse.json({
      success: true,
      data: {
        enabled: true,
        globals: {
          advanceNoticeDays: settings.rentalPriceAdvanceNoticeDays,
          allowExceedingStreetRate: settings.rentalPriceAllowExceedingStreetRate,
          roundToNearestDollar: settings.rentalPriceRoundToNearestDollar,
        },
        occupancy,
        streetRates,
        unitTypeSuggestions,
        rentalSuggestions,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
