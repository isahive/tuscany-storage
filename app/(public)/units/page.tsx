'use client'

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

// ─── Mock data (swap for GET /api/units?status=available when Dev 1 is ready) ─
const MOCK_UNITS = [
  {
    id: '1',
    unitNumber: '1A',
    size: '5×5',
    width: 5,
    depth: 5,
    sqft: 25,
    type: 'standard' as const,
    price: 4500,
    status: 'available' as const,
    features: ['Ground floor', 'LED lighting', 'Digital lock'],
    image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80',
    description: 'Perfect for a few boxes, seasonal items, or small furniture. Roughly the size of a large closet.',
  },
  {
    id: '2',
    unitNumber: '3B',
    size: '5×10',
    width: 5,
    depth: 10,
    sqft: 50,
    type: 'standard' as const,
    price: 6500,
    status: 'available' as const,
    features: ['Ground floor', 'LED lighting'],
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80',
    description: 'Ideal for a studio apartment or small bedroom worth of belongings.',
  },
  {
    id: '3',
    unitNumber: '7C',
    size: '10×10',
    width: 10,
    depth: 10,
    sqft: 100,
    type: 'climate_controlled' as const,
    price: 10000,
    status: 'available' as const,
    features: ['Climate controlled', 'Indoor access', 'LED lighting', 'Humidity control'],
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=80',
    description: 'Climate controlled unit — ideal for furniture, electronics, documents, or antiques.',
  },
  {
    id: '4',
    unitNumber: '12D',
    size: '10×10',
    width: 10,
    depth: 10,
    sqft: 100,
    type: 'drive_up' as const,
    price: 8500,
    status: 'available' as const,
    features: ['Drive-up access', 'Ground floor', 'Wide doors'],
    image: 'https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=600&q=80',
    description: 'Drive right up to the door. Great for loading and unloading heavy or bulky items.',
  },
  {
    id: '5',
    unitNumber: '14B',
    size: '10×15',
    width: 10,
    depth: 15,
    sqft: 150,
    type: 'climate_controlled' as const,
    price: 13500,
    status: 'available' as const,
    features: ['Climate controlled', 'Indoor access', 'LED lighting'],
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=80',
    description: 'Great for 1–2 bedroom apartment contents with climate protection.',
  },
  {
    id: '6',
    unitNumber: '22A',
    size: '10×20',
    width: 10,
    depth: 20,
    sqft: 200,
    type: 'drive_up' as const,
    price: 16500,
    status: 'available' as const,
    features: ['Drive-up access', 'Ground floor', 'Extra height', 'Wide doors'],
    image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=600&q=80',
    description: 'Perfect for storing the contents of a 2–3 bedroom home or a small business inventory.',
  },
  {
    id: '7',
    unitNumber: '30C',
    size: '10×30',
    width: 10,
    depth: 30,
    sqft: 300,
    type: 'drive_up' as const,
    price: 22000,
    status: 'available' as const,
    features: ['Drive-up access', 'Ground floor', 'Extra height'],
    image: 'https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=600&q=80',
    description: 'Our largest drive-up unit. Suitable for large homes, vehicles, or business equipment.',
  },
  {
    id: '8',
    unitNumber: 'V01',
    size: '12×25',
    width: 12,
    depth: 25,
    sqft: 300,
    type: 'vehicle_outdoor' as const,
    price: 9500,
    status: 'available' as const,
    features: ['Outdoor parking', 'Gated access', '24/7 surveillance'],
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    description: 'Outdoor vehicle storage for cars, trucks, boats, or RVs. Secure gated access.',
  },
]

type UnitType = 'all' | 'standard' | 'climate_controlled' | 'drive_up' | 'vehicle_outdoor'

const TYPE_LABELS: Record<string, string> = {
  all: 'All Units',
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle Storage',
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export default function UnitsPage() {
  const [activeType, setActiveType] = useState<UnitType>('all')
  const [maxPrice, setMaxPrice] = useState<number>(99999)
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'size_asc'>('price_asc')

  const filtered = MOCK_UNITS.filter((u) => {
    if (activeType !== 'all' && u.type !== activeType) return false
    if (u.price > maxPrice) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'price_asc') return a.price - b.price
    if (sortBy === 'price_desc') return b.price - a.price
    return a.sqft - b.sqft
  })

  return (
    <>
      {/* Page header */}
      <div className="bg-brown py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl">
            Available Units
          </h1>
          <p className="mt-3 text-cream/60">
            {MOCK_UNITS.length} units · Starting at {formatMoney(Math.min(...MOCK_UNITS.map((u) => u.price)))}/mo
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-16 z-30 border-b border-mid bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 py-3">
            {/* Type filters */}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABELS) as UnitType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveType(t)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeType === t
                      ? 'bg-brown text-cream'
                      : 'bg-mid/50 text-brown hover:bg-mid'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded border border-mid px-3 py-1.5 text-sm text-brown focus:border-tan focus:outline-none"
            >
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="size_asc">Size: Smallest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-serif text-2xl text-brown">No units match your filters</p>
            <p className="mt-2 text-muted">Try adjusting your filters or join the waiting list.</p>
            <Link
              href="/waiting-list"
              className="mt-6 inline-block rounded bg-tan px-6 py-2.5 font-semibold text-brown hover:bg-tan-light transition-colors"
            >
              Join Waiting List
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted">
              Showing {filtered.length} unit{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((unit) => (
                <article
                  key={unit.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-mid bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Photo */}
                  <div className="relative h-44 overflow-hidden">
                    <Image
                      src={unit.image}
                      alt={`${unit.size} ${unit.type} storage unit`}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brown/40 to-transparent" />
                    <span className="absolute bottom-3 left-3 rounded bg-brown/80 px-2 py-0.5 text-xs font-semibold text-cream backdrop-blur-sm">
                      Unit {unit.unitNumber}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex flex-col justify-between h-full p-5">
                    {/* Top section */}
                    <div>
                      <div className="mb-1 flex items-start justify-between">
                        <div>
                          <p className="font-serif text-2xl font-bold text-brown">{unit.size}</p>
                          <p className="text-xs text-muted">{unit.sqft} sq ft</p>
                        </div>
                        <span className="rounded-full bg-olive/10 px-2 py-0.5 text-xs font-semibold text-olive">
                          Available
                        </span>
                      </div>

                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-tan">
                        {TYPE_LABELS[unit.type]}
                      </p>

                      <p className="mb-4 text-xs leading-relaxed text-muted">
                        {unit.description}
                      </p>

                      <ul className="mb-5 space-y-1">
                        {[0, 1, 2].map((i) => {
                          const f = unit.features[i]
                          return (
                            <li key={i} className={`flex items-center gap-1.5 text-xs text-muted ${!f ? 'invisible' : ''}`}>
                              <svg className="h-3.5 w-3.5 flex-shrink-0 text-olive" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              {f ?? '\u00A0'}
                            </li>
                          )
                        })}
                      </ul>
                    </div>

                    {/* Bottom section — always flush to bottom */}
                    <div className="flex items-center justify-between border-t border-mid pt-4">
                      <div>
                        <span className="font-serif text-xl font-bold text-brown">
                          {formatMoney(unit.price)}
                        </span>
                        <span className="text-xs text-muted">/mo</span>
                      </div>
                      <Link
                        href="/waiting-list"
                        className="rounded bg-tan px-3 py-1.5 text-xs font-semibold text-brown hover:bg-tan-light transition-colors"
                      >
                        Reserve Now
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="border-t border-mid bg-cream py-12">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="font-serif text-2xl font-bold text-brown">
            Don&apos;t see what you need?
          </h2>
          <p className="mt-3 text-muted">
            Units open up regularly. Join our waiting list and we&apos;ll contact you the
            moment a matching unit becomes available.
          </p>
          <Link
            href="/waiting-list"
            className="mt-6 inline-block rounded bg-tan px-8 py-3 font-semibold text-brown hover:bg-tan-light transition-colors"
          >
            Join the Waiting List
          </Link>
        </div>
      </div>
    </>
  )
}
