'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const MOCK_UNITS: Record<string, {
  unitNumber: string
  size: string
  sqft: number
  type: string
  floor: string
  price: number
  features: string[]
  description: string
  imageUrl: string
}> = {
  '1a-5x5-standard': {
    unitNumber: '1A',
    size: '5\u00d75',
    sqft: 25,
    type: 'Standard',
    floor: 'Ground Floor',
    price: 5500,
    features: ['Ground floor access', 'LED lighting', 'Wide hallways'],
    description:
      'Perfect for storing boxes, small furniture, or seasonal items. This compact unit is ideal for college students or those needing a little extra space.',
    imageUrl: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800&h=500&fit=crop',
  },
  '14b-10x10-climate': {
    unitNumber: '14B',
    size: '10\u00d710',
    sqft: 100,
    type: 'Climate Controlled',
    floor: 'Ground Floor',
    price: 12500,
    features: ['Climate controlled', 'Ground floor access', 'LED lighting', '24/7 access'],
    description:
      'Our most popular size. Climate controlled to protect your belongings from heat, humidity, and cold. Perfect for a one-bedroom apartment or small office.',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=500&fit=crop',
  },
  '22a-10x20-driveup': {
    unitNumber: '22A',
    size: '10\u00d720',
    sqft: 200,
    type: 'Drive-Up',
    floor: 'Ground Floor',
    price: 16500,
    features: ['Drive-up access', 'Extra wide door', 'Ground floor', 'Vehicle accessible'],
    description:
      'Drive right up to your unit for easy loading and unloading. Great for large furniture, appliances, or business inventory.',
    imageUrl: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&h=500&fit=crop',
  },
}

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

export default function UnitDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const unit = MOCK_UNITS[slug]

  if (!unit) {
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
        <Link
          href="/units"
          className="bg-tan text-brown font-medium px-6 py-3 rounded hover:bg-tan-light transition-colors"
        >
          Browse All Units
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-cream min-h-screen">
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
              src={unit.imageUrl}
              alt={`Unit ${unit.unitNumber} — ${unit.size} ${unit.type}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute top-3 left-3 bg-brown text-white text-xs font-semibold px-3 py-1 rounded">
              {unit.type}
            </div>
          </div>

          {/* Details */}
          <div>
            <h1 className="text-3xl font-bold text-brown font-[family-name:var(--font-playfair)] mb-2">
              Unit {unit.unitNumber}
            </h1>
            <p className="text-muted mb-6">{unit.size} &middot; {unit.sqft} sq ft &middot; {unit.floor}</p>

            <div className="bg-white rounded-lg border border-mid p-6 mb-6">
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-brown">{formatMoney(unit.price)}</span>
                <span className="text-muted">/month</span>
              </div>
              <p className="text-sm text-muted mb-4">No long-term commitment. Month-to-month.</p>
              <Link
                href="/waiting-list"
                className="block w-full text-center bg-tan text-brown font-semibold px-6 py-3 rounded hover:bg-tan-light transition-colors"
              >
                Reserve This Unit
              </Link>
            </div>

            <p className="text-brown/80 leading-relaxed mb-6">{unit.description}</p>

            {/* Features */}
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

            <Link
              href="/units"
              className="inline-flex items-center gap-1 text-tan font-medium hover:text-tan-light transition-colors"
            >
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
