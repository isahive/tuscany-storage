'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const TYPE_LABELS: Record<string, string> = {
  all: 'All Units',
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle Storage',
}

const TYPE_IMAGES: Record<string, string> = {
  standard: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80',
  climate_controlled: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=80',
  drive_up: 'https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=600&q=80',
  vehicle_outdoor: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
}

type UnitType = 'all' | 'standard' | 'climate_controlled' | 'drive_up' | 'vehicle_outdoor'

interface Unit {
  _id: string
  unitNumber: string
  size: string
  width: number
  depth: number
  sqft: number
  type: string
  floor: string
  price: number
  status: string
  features: string[]
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<UnitType>('all')
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'size_asc'>('price_asc')

  useEffect(() => {
    fetch('/api/units?status=available&limit=100')
      .then((r) => r.json())
      .then((json) => { if (json.success) setUnits(json.data.items ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = units
    .filter((u) => activeType === 'all' || u.type === activeType)
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price
      if (sortBy === 'price_desc') return b.price - a.price
      return a.sqft - b.sqft
    })

  const minPrice = units.length ? Math.min(...units.map((u) => u.price)) : 0

  return (
    <>
      {/* JSON-LD Service schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            "serviceType": "Self Storage",
            "provider": {
              "@type": "LocalBusiness",
              "name": "Tuscany Village Self Storage"
            },
            "areaServed": {
              "@type": "City",
              "name": "Caryville",
              "containedInPlace": { "@type": "State", "name": "Tennessee" }
            },
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "Storage Units",
              "itemListElement": [
                { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "5x10 Storage Unit", "description": "50 sq ft drive-up storage unit" }, "price": "65.00", "priceCurrency": "USD", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "65.00", "priceCurrency": "USD", "unitText": "month" } },
                { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "10x10 Storage Unit", "description": "100 sq ft drive-up storage unit" }, "price": "110.00", "priceCurrency": "USD", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "110.00", "priceCurrency": "USD", "unitText": "month" } },
                { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "10x15 Storage Unit", "description": "150 sq ft drive-up storage unit" }, "price": "120.00", "priceCurrency": "USD", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "120.00", "priceCurrency": "USD", "unitText": "month" } },
                { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "10x20 Storage Unit", "description": "200 sq ft drive-up storage unit" }, "price": "140.00", "priceCurrency": "USD", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "140.00", "priceCurrency": "USD", "unitText": "month" } },
                { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "10x30 Storage Unit", "description": "300 sq ft drive-up storage unit" }, "price": "180.00", "priceCurrency": "USD", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "180.00", "priceCurrency": "USD", "unitText": "month" } },
                { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Boat/RV/Camper Storage", "description": "10x30 open air vehicle storage" }, "price": "80.00", "priceCurrency": "USD", "priceSpecification": { "@type": "UnitPriceSpecification", "price": "80.00", "priceCurrency": "USD", "unitText": "month" } }
              ]
            }
          })
        }}
      />

      {/* Page header */}
      <div className="bg-brown py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl">
            Available Units
          </h1>
          <p className="mt-3 text-cream/60">
            {loading ? 'Loading…' : `${units.length} unit${units.length !== 1 ? 's' : ''} · Starting at ${formatMoney(minPrice)}/mo`}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-16 z-30 border-b border-mid bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 py-3">
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
            <div className="flex-1" />
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
        {loading ? (
          <div className="py-20 text-center">
            <p className="text-muted">Loading available units…</p>
          </div>
        ) : filtered.length === 0 ? (
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
                  key={unit._id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-mid bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Photo */}
                  <div className="relative h-44 overflow-hidden">
                    <Image
                      src={TYPE_IMAGES[unit.type] ?? TYPE_IMAGES.standard}
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
                        {TYPE_LABELS[unit.type] ?? unit.type}
                      </p>

                      <ul className="mb-5 space-y-1">
                        {unit.features.slice(0, 3).map((f) => (
                          <li key={f} className="flex items-center gap-1.5 text-xs text-muted">
                            <svg className="h-3.5 w-3.5 flex-shrink-0 text-olive" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between border-t border-mid pt-4">
                      <div>
                        <span className="font-serif text-xl font-bold text-brown">
                          {formatMoney(unit.price)}
                        </span>
                        <span className="text-xs text-muted">/mo</span>
                      </div>
                      <Link
                        href={`/units/${unit._id}`}
                        className="rounded bg-tan px-3 py-1.5 text-xs font-semibold text-brown hover:bg-tan-light transition-colors"
                      >
                        Reserve →
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
