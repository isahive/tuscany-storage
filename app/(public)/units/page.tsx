import type { Metadata } from 'next'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Promotion from '@/models/Promotion'
import Settings from '@/models/Settings'
import UnitsCanvas from '@/components/public/UnitsCanvas'
import SizeCard from '@/components/public/SizeCard'
import { feeForUnitType } from '@/lib/reservationFee'

export const metadata: Metadata = {
  title: 'Rent Storage | Tuscany Village Self Storage',
  description:
    'Browse storage unit sizes and pricing at Tuscany Village Self Storage in Caryville, TN. Boat, camper, RV & trailer storage available.',
}

export const dynamic = 'force-dynamic'

type ActivePromo = {
  name: string
  description: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  allUnitTypes: boolean
  unitTypes: string[]
}

// Display label + image override per size key (matches admin/DB `size` field)
const SIZE_DISPLAY: Record<
  string,
  { label: string; image: string; vehicleVariant?: boolean }
> = {
  '5x10':              { label: '5 x 10',  image: '/images/units/5x10.png' },
  '10x10':             { label: '10 x 10', image: '/images/units/10x10.png' },
  '10x15':             { label: '10 x 15', image: '/images/units/10x15.png' },
  '10x20':             { label: '10 x 20', image: '/images/units/10x20.png' },
  '10x30':             { label: '10 x 30', image: '/images/units/10x30.png' },
  '10x30_vehicle':     {
    label: 'Boat, RV, Camper & Trailer - Open Air (10 x 30)',
    image: '/images/units/fifth.png',
    vehicleVariant: true,
  },
}

type SizeGroup = {
  sizeKey: string
  units: Array<{ _id: string; unitNumber: string; price: number; status: string; type: string }>
}

function formatMoney(cents: number): string {
  const dollars = cents / 100
  return Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`
}

async function getData(): Promise<{
  groups: SizeGroup[]
  canvasUnits: Array<{
    id: string; unitNumber: string; width: number; depth: number;
    size: string; type: string; status: string;
    gridX: number; gridY: number; gridFloor?: number; gridRotation: 0 | 90
  }>
  promos: ActivePromo[]
  reservationFees: Array<{ unitType: string; amount: number }>
  reservationsEnabled: boolean
}> {
  try {
    await connectDB()
    const now = new Date()
    const [units, promoDocs, settings] = await Promise.all([
      Unit.find({}).lean(),
      Promotion.find({
        status: 'active',
        method: 'automatic',
        startDate: { $lte: now },
        $or: [{ noExpiration: true }, { endDate: null }, { endDate: { $gte: now } }],
      }).lean(),
      Settings.findOne({}).lean<{
        enableReservations?: boolean
        unitTypeReservationFees?: Array<{ unitType: string; amount: number }>
      }>(),
    ])
    const reservationFees = settings?.unitTypeReservationFees ?? []
    const reservationsEnabled = settings?.enableReservations !== false

    const promos: ActivePromo[] = promoDocs.map((p: any) => ({
      name: p.name,
      description: p.description ?? '',
      discountType: p.discountType,
      discountValue: p.discountValue,
      allUnitTypes: !!p.allUnitTypes,
      unitTypes: p.unitTypes ?? [],
    }))

    const groups = new Map<string, SizeGroup>()
    const canvasUnits: any[] = []
    for (const u of units) {
      const key = u.type === 'vehicle_outdoor' && u.size === '10x30'
        ? '10x30_vehicle'
        : (u.size as string)
      if (!groups.has(key)) groups.set(key, { sizeKey: key, units: [] })
      groups.get(key)!.units.push({
        _id: String(u._id),
        unitNumber: u.unitNumber as string,
        price: u.price as number,
        status: u.status as string,
        type: u.type as string,
      })

      if (typeof u.gridX === 'number' && typeof u.gridY === 'number') {
        canvasUnits.push({
          id: String(u._id),
          unitNumber: u.unitNumber,
          width: u.width,
          depth: u.depth,
          size: u.size,
          type: u.type,
          status: u.status,
          gridX: u.gridX,
          gridY: u.gridY,
          gridFloor: u.gridFloor,
          gridRotation: u.gridRotation === 90 ? 90 : 0,
        })
      }
    }

    const order = ['5x10', '10x10', '10x15', '10x20', '10x30_vehicle', '10x30']
    const orderedGroups = order
      .map((k) => groups.get(k))
      .filter((g): g is SizeGroup => Boolean(g))

    return { groups: orderedGroups, canvasUnits, promos, reservationFees, reservationsEnabled }
  } catch {
    return { groups: [], canvasUnits: [], promos: [], reservationFees: [], reservationsEnabled: true }
  }
}

/** Find first active promo that applies to a given unit type. */
function promoFor(type: string, promos: ActivePromo[]): ActivePromo | null {
  for (const p of promos) {
    if (p.allUnitTypes || p.unitTypes.includes(type)) return p
  }
  return null
}

/** Apply promo to a base price (cents). Returns discounted cents. */
function applyPromo(basePriceCents: number, promo: ActivePromo): number {
  if (promo.discountType === 'percentage') {
    return Math.round(basePriceCents * (1 - promo.discountValue / 100))
  }
  // fixed = discountValue is in cents
  return Math.max(0, basePriceCents - promo.discountValue)
}

export default async function RentStoragePage() {
  const { groups, canvasUnits, promos, reservationFees, reservationsEnabled } = await getData()

  return (
    <div className="bg-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-center text-4xl font-normal text-gray-800 sm:text-5xl">
          Rent Storage
        </h1>
        <p className="mt-6 text-base text-gray-700">
          We have a variety of unit sizes to meet every storage need.
        </p>

        {groups.length === 0 ? (
          <p className="mt-12 text-center text-gray-600">
            Units are being added. Please check back soon.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {groups.map((g) => {
              const display = SIZE_DISPLAY[g.sizeKey] ?? {
                label: g.sizeKey,
                image: '/images/units/10x10.png',
              }
              const allPrices = g.units.map((u) => u.price)
              const minPrice = allPrices.length ? Math.min(...allPrices) : 0
              const maxPrice = allPrices.length ? Math.max(...allPrices) : 0
              const sampleType = g.units[0]?.type ?? 'standard'
              const promo = promoFor(sampleType, promos)
              const currentPriceCents = promo ? applyPromo(minPrice, promo) : minPrice
              const hasPromo = !!promo && currentPriceCents !== minPrice
              const reservationFeeCents = reservationsEnabled
                ? feeForUnitType(sampleType, reservationFees)
                : 0
              return (
                <SizeCard
                  key={g.sizeKey}
                  sizeKey={g.sizeKey}
                  label={display.label}
                  image={display.image}
                  units={g.units}
                  originalPriceCents={minPrice}
                  currentPriceCents={currentPriceCents}
                  hasPriceRange={minPrice !== maxPrice}
                  hasPromo={hasPromo}
                  promoText={promo ? `${promo.name}: ${promo.description}` : undefined}
                  reservationFeeCents={reservationFeeCents}
                />
              )
            })}
          </div>
        )}

        {canvasUnits.length > 0 && (
          <div className="mt-10">
            <UnitsCanvas units={canvasUnits} />
          </div>
        )}
      </div>
    </div>
  )
}

