'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, type ReactNode } from 'react'

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

const TYPE_ICONS: Record<string, ReactNode> = {
  all: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  standard: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  climate_controlled: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    </svg>
  ),
  drive_up: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.143-.504 1.125-1.125a17.902 17.902 0 00-3.213-9.174L15.443 4.68a3.375 3.375 0 00-2.818-1.518H7.5v10.5h9V4.68" />
    </svg>
  ),
  vehicle_outdoor: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.143-.504 1.125-1.125a17.902 17.902 0 00-3.213-9.174L15.443 4.68" />
    </svg>
  ),
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

      {/* Hero header */}
      <div className="relative overflow-hidden bg-brown py-16 sm:py-24">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-tan" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-tan" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
              Tuscany Village Self Storage
            </p>
            <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl lg:text-6xl">
              Find Your Perfect Unit
            </h1>
            <p className="mt-4 text-lg text-cream/50">
              {loading
                ? 'Loading available units...'
                : `${units.length} unit${units.length !== 1 ? 's' : ''} available \u00b7 Starting at ${formatMoney(minPrice)}/mo`}
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-20 z-30 border-b border-mid/60 bg-cream/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 py-4">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABELS) as UnitType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveType(t)}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
                    activeType === t
                      ? 'bg-brown text-cream shadow-md shadow-brown/20'
                      : 'border border-mid bg-white text-muted hover:border-tan/40 hover:text-brown hover:shadow-sm'
                  }`}
                >
                  <span className={activeType === t ? 'text-tan' : 'text-muted/60'}>{TYPE_ICONS[t]}</span>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="appearance-none rounded-full border border-mid bg-white px-5 py-2 pr-10 text-sm font-medium text-brown transition-all hover:border-tan/40 hover:shadow-sm focus:border-tan focus:outline-none"
              >
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="size_asc">Size: Smallest First</option>
              </select>
              <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-cream">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          {loading ? (
            <div className="py-24 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-mid border-t-tan" />
              <p className="text-muted">Loading available units...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-mid/50">
                <svg className="h-8 w-8 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <p className="font-serif text-2xl font-bold text-brown">No units match your filters</p>
              <p className="mx-auto mt-3 max-w-md text-muted">
                Try adjusting your filters or join the waiting list to be notified when a matching unit opens up.
              </p>
              <Link
                href="/waiting-list"
                className="mt-8 inline-block rounded-full bg-tan px-8 py-3 font-semibold text-brown shadow-md shadow-tan/20 transition-all hover:-translate-y-0.5 hover:bg-tan-light hover:shadow-lg hover:shadow-tan/30"
              >
                Join Waiting List
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-8 text-sm font-medium text-muted">
                Showing {filtered.length} unit{filtered.length !== 1 ? 's' : ''}
              </p>
              <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((unit) => (
                  <article
                    key={unit._id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-mid/60 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brown/[0.06]"
                  >
                    {/* Photo */}
                    <div className="relative h-48 overflow-hidden">
                      <Image
                        src={TYPE_IMAGES[unit.type] ?? TYPE_IMAGES.standard}
                        alt={`${unit.size} ${unit.type} storage unit`}
                        fill
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-brown/50 via-brown/10 to-transparent" />
                      <span className="absolute bottom-3 left-3 rounded-full bg-brown/70 px-3 py-1 text-xs font-semibold text-cream backdrop-blur-md">
                        Unit {unit.unitNumber}
                      </span>
                      <span className="absolute right-3 top-3 rounded-full bg-olive/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                        Available
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col justify-between p-6">
                      <div>
                        <div className="mb-1.5 flex items-start justify-between">
                          <div>
                            <p className="font-serif text-2xl font-bold text-brown">{unit.size}</p>
                            <p className="text-xs text-muted">{unit.sqft} sq ft</p>
                          </div>
                        </div>

                        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-tan">
                          {TYPE_LABELS[unit.type] ?? unit.type}
                        </p>

                        <ul className="mb-5 space-y-1.5">
                          {unit.features.slice(0, 3).map((f) => (
                            <li key={f} className="flex items-center gap-2 text-xs text-muted">
                              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-olive/10">
                                <svg className="h-2.5 w-2.5 text-olive" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              </span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex items-center justify-between border-t border-mid/50 pt-5">
                        <div>
                          <span className="font-serif text-2xl font-bold text-brown">
                            {formatMoney(unit.price)}
                          </span>
                          <span className="ml-0.5 text-xs text-muted">/mo</span>
                        </div>
                        <Link
                          href={`/units/${unit._id}`}
                          className="rounded-full bg-brown px-4 py-2 text-xs font-semibold text-cream transition-all duration-200 hover:bg-tan hover:text-brown hover:shadow-md"
                        >
                          Reserve
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="relative overflow-hidden border-t border-mid bg-white py-16 sm:py-20">
        <div className="absolute inset-0 opacity-[0.02]">
          <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-tan" />
        </div>
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
            Don&apos;t see what you need?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted">
            Units open up regularly. Join our waiting list and we&apos;ll contact you the
            moment a matching unit becomes available.
          </p>
          <Link
            href="/waiting-list"
            className="mt-8 inline-block rounded-full bg-tan px-10 py-3.5 font-semibold text-brown shadow-md shadow-tan/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-tan-light hover:shadow-lg hover:shadow-tan/30"
          >
            Join the Waiting List
          </Link>
        </div>
      </div>
    </>
  )
}
