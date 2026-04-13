'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'

const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle Storage',
}

const FLOOR_LABELS: Record<string, string> = {
  ground: 'Ground Floor',
  upper: 'Upper Floor',
}

const TYPE_IMAGES: Record<string, string> = {
  standard: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800&h=500&fit=crop',
  climate_controlled: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=500&fit=crop',
  drive_up: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&h=500&fit=crop',
  vehicle_outdoor: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop',
}

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

interface Unit {
  _id: string
  unitNumber: string
  size: string
  sqft: number
  type: string
  floor: string
  price: number
  status: string
  features: string[]
}

export default function UnitDetailPage() {
  const params = useParams()
  const id = params.slug as string
  const [unit, setUnit] = useState<Unit | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/units/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setUnit(json.data)
        } else {
          setNotFound(true)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (notFound || !unit) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-mid flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-brown font-[family-name:var(--font-playfair)] mb-2">
          Unit Not Found
        </h2>
        <p className="text-muted mb-6">The unit you&apos;re looking for doesn&apos;t exist or is no longer available.</p>
        <Link href="/units" className="bg-tan text-brown font-medium px-6 py-3 rounded hover:bg-tan-light transition-colors">
          Browse All Units
        </Link>
      </div>
    )
  }

  const imageUrl = TYPE_IMAGES[unit.type] ?? TYPE_IMAGES.standard
  const typeLabel = TYPE_LABELS[unit.type] ?? unit.type
  const floorLabel = FLOOR_LABELS[unit.floor] ?? unit.floor
  const isAvailable = unit.status === 'available'

  return (
    <div className="bg-cream min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://tuscanystorage.com/' },
            { '@type': 'ListItem', position: 2, name: 'Units', item: 'https://tuscanystorage.com/units' },
            { '@type': 'ListItem', position: 3, name: `Unit ${unit.unitNumber}` },
          ],
        }) }}
      />
      {/* Breadcrumb */}
      <div className="bg-white border-b border-mid">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted">
            <Link href="/" className="hover:text-brown transition-colors">Home</Link>
            <span>/</span>
            <Link href="/units" className="hover:text-brown transition-colors">Units</Link>
            <span>/</span>
            <span className="text-brown font-medium">Unit {unit.unitNumber}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Image */}
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-mid">
            <Image
              src={imageUrl}
              alt={`Unit ${unit.unitNumber} — ${unit.size} ${typeLabel}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute top-3 left-3 bg-brown text-white text-xs font-semibold px-3 py-1 rounded">
              {typeLabel}
            </div>
          </div>

          {/* Details */}
          <div>
            <h1 className="text-3xl font-bold text-brown font-[family-name:var(--font-playfair)] mb-2">
              Unit {unit.unitNumber}
            </h1>
            <p className="text-muted mb-6">
              {unit.size} &middot; {unit.sqft} sq ft &middot; {floorLabel}
            </p>

            <div className="bg-white rounded-lg border border-mid p-6 mb-6">
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-brown">{formatMoney(unit.price)}</span>
                <span className="text-muted">/month</span>
              </div>
              <p className="text-sm text-muted mb-4">No long-term commitment. Month-to-month.</p>
              {isAvailable ? (
                <Link
                  href={`/reserve/${unit._id}`}
                  className="block w-full text-center bg-tan text-brown font-semibold px-6 py-3 rounded hover:bg-tan-light transition-colors"
                >
                  Reserve This Unit →
                </Link>
              ) : (
                <Link
                  href="/waiting-list"
                  className="block w-full text-center bg-mid text-muted font-semibold px-6 py-3 rounded hover:bg-mid/80 transition-colors"
                >
                  Join Waiting List
                </Link>
              )}
            </div>

            {/* Features */}
            {unit.features.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-brown uppercase tracking-wider mb-3">Features</h3>
                <ul className="space-y-2 mb-8">
                  {unit.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-brown/80">
                      <svg className="w-4 h-4 text-olive flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <Link href="/units" className="inline-flex items-center gap-1 text-tan font-medium hover:text-tan-light transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to all units
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
