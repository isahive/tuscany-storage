import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Storage Size Guide',
  description: 'Not sure what size storage unit you need? Use our size guide to find the perfect fit at Tuscany Village Self Storage.',
}

const SIZES = [
  {
    size: '5×5',
    sqft: 25,
    analogy: 'Large Walk-In Closet',
    price: 4500,
    fits: [
      'Boxes and small items',
      'Seasonal decorations',
      'Sports equipment',
      'Small furniture (chair, end table)',
      'Bicycles',
    ],
    notFits: ['Bedroom furniture sets', 'Appliances', 'Couches'],
    bestFor: 'Decluttering or storing a few boxes between moves.',
  },
  {
    size: '5×10',
    sqft: 50,
    analogy: 'Small Bedroom',
    price: 6500,
    fits: [
      'Studio apartment contents',
      'Twin bed and dresser',
      'Small couch',
      'Multiple boxes',
      'Small appliances',
    ],
    notFits: ['King or queen bedroom sets', 'Large appliances like refrigerators'],
    bestFor: 'Students, small apartments, or short-term storage during a move.',
  },
  {
    size: '10×10',
    sqft: 100,
    analogy: 'Standard Bedroom',
    price: 8500,
    fits: [
      '1-bedroom apartment contents',
      'Queen bedroom set',
      'Couch + loveseat',
      'Washer and dryer',
      'Dining set',
      '10–15 boxes',
    ],
    notFits: ['Full 2-bedroom home contents'],
    bestFor: 'Our most popular size. Perfect for 1-bedroom apartments and downsizing.',
    popular: true,
  },
  {
    size: '10×15',
    sqft: 150,
    analogy: '1½ Bedrooms',
    price: 13500,
    fits: [
      '1–2 bedroom apartment contents',
      'Multiple bedroom sets',
      'Large appliances',
      'Patio furniture',
      'Outdoor equipment',
    ],
    notFits: ['3+ bedroom homes'],
    bestFor: 'Larger apartments or storing contents from a 1–2 bedroom home during renovation.',
  },
  {
    size: '10×20',
    sqft: 200,
    analogy: '2-Car Garage',
    price: 16500,
    fits: [
      '2–3 bedroom home contents',
      'Full living room set',
      'Multiple bedroom sets',
      'Large appliances',
      'Business inventory',
    ],
    notFits: ['Very large homes (4+ bedrooms)'],
    bestFor: 'Storing the full contents of a 2–3 bedroom home or a small business.',
  },
  {
    size: '10×30',
    sqft: 300,
    analogy: 'Large Garage + Extra',
    price: 22000,
    fits: [
      '4–5 bedroom home contents',
      'Large vehicles',
      'Commercial equipment',
      'Business inventory',
      'Construction materials',
    ],
    notFits: [],
    bestFor: 'Our largest unit. Great for large homes, contractors, or businesses.',
  },
]

const TYPES = [
  {
    type: 'Standard',
    icon: '📦',
    description: 'Indoor or outdoor units without climate control. Great for items that can withstand temperature fluctuations.',
    bestFor: ['Furniture', 'Clothing', 'Boxes', 'Tools'],
  },
  {
    type: 'Climate Controlled',
    icon: '🌡️',
    description: 'Temperature and humidity regulated (65–80°F year-round). Protects sensitive items from heat, cold, and moisture.',
    bestFor: ['Electronics', 'Artwork & antiques', 'Documents', 'Wine', 'Musical instruments'],
  },
  {
    type: 'Drive-Up',
    icon: '🚛',
    description: 'Pull your vehicle right up to the unit door. No carrying items through hallways.',
    bestFor: ['Heavy furniture', 'Appliances', 'Frequent access', 'Business inventory'],
  },
  {
    type: 'Vehicle Storage',
    icon: '🚗',
    description: 'Outdoor gated spaces for cars, trucks, boats, trailers, or RVs.',
    bestFor: ['Seasonal vehicles', 'Boats', 'RVs', 'Trailers', 'Classic cars'],
  },
]

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export default function SizeGuidePage() {
  return (
    <>
      {/* Header */}
      <div className="bg-brown py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl">Size Guide</h1>
          <p className="mt-3 max-w-xl text-cream/60">
            Choose the right unit the first time. Here&apos;s a detailed breakdown of what fits in each size.
          </p>
        </div>
      </div>

      {/* Unit types */}
      <div className="border-b border-mid bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 font-serif text-2xl font-bold text-brown sm:text-3xl">
            Unit Types
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TYPES.map((t) => (
              <div key={t.type} className="rounded-xl border border-mid p-5">
                <div className="mb-3 text-3xl">{t.icon}</div>
                <h3 className="mb-1 font-semibold text-brown">{t.type}</h3>
                <p className="mb-4 text-xs leading-relaxed text-muted">{t.description}</p>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-tan">Best for</p>
                  <ul className="space-y-1">
                    {t.bestFor.map((item) => (
                      <li key={item} className="flex items-center gap-1.5 text-xs text-muted">
                        <span className="h-1 w-1 rounded-full bg-tan" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Size breakdown */}
      <div className="py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 font-serif text-2xl font-bold text-brown sm:text-3xl">
            Sizes at a Glance
          </h2>

          <div className="space-y-4">
            {SIZES.map((s) => (
              <div
                key={s.size}
                className={`rounded-xl border p-6 transition-shadow hover:shadow-md ${
                  s.popular
                    ? 'border-tan bg-tan/5 shadow-sm'
                    : 'border-mid bg-white'
                }`}
              >
                {s.popular && (
                  <div className="mb-3">
                    <span className="rounded-full bg-tan px-3 py-1 text-xs font-semibold text-brown">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="grid gap-6 lg:grid-cols-4">
                  {/* Size info */}
                  <div>
                    <div className="flex items-baseline gap-2">
                      <p className="font-serif text-3xl font-bold text-brown">{s.size}</p>
                      <p className="text-sm text-muted">{s.sqft} sq ft</p>
                    </div>
                    <p className="mt-1 text-sm font-medium text-tan">{s.analogy}</p>
                    <p className="mt-3 text-xs leading-relaxed text-muted">{s.bestFor}</p>
                    <div className="mt-4">
                      <p className="font-serif text-xl font-bold text-brown">
                        {formatMoney(s.price)}<span className="text-sm font-sans font-normal text-muted">/mo</span>
                      </p>
                    </div>
                  </div>

                  {/* Visual block */}
                  <div className="flex items-center justify-center lg:col-span-1">
                    <div
                      className="rounded border-2 border-tan/40 bg-tan/10"
                      style={{
                        width: `${Math.min(s.sqft * 0.5 + 40, 160)}px`,
                        height: `${Math.min(s.sqft * 0.3 + 40, 100)}px`,
                      }}
                    >
                      <div className="flex h-full items-center justify-center">
                        <span className="text-xs font-bold text-tan/70">{s.size}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fits */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-olive">
                      ✓ Fits
                    </p>
                    <ul className="space-y-1">
                      {s.fits.map((item) => (
                        <li key={item} className="flex items-center gap-1.5 text-xs text-muted">
                          <svg className="h-3.5 w-3.5 flex-shrink-0 text-olive" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action */}
                  <div className="flex flex-col justify-between">
                    {s.notFits.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                          ✗ Might not fit
                        </p>
                        <ul className="space-y-1">
                          {s.notFits.map((item) => (
                            <li key={item} className="flex items-center gap-1.5 text-xs text-muted/70">
                              <svg className="h-3.5 w-3.5 flex-shrink-0 text-muted/50" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Link
                      href="/units"
                      className="mt-4 inline-block rounded bg-tan px-5 py-2 text-center text-sm font-semibold text-brown hover:bg-tan-light transition-colors"
                    >
                      See {s.size} units →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Help CTA */}
      <div className="bg-brown py-14">
        <div className="mx-auto max-w-xl px-4 text-center">
          <h2 className="font-serif text-2xl font-bold text-cream">Still not sure?</h2>
          <p className="mt-3 text-cream/60">
            Give us a call or send a message. We&apos;ll help you pick the right size based on what you need to store.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="tel:+18435551234"
              className="w-full rounded bg-tan px-6 py-3 font-semibold text-brown hover:bg-tan-light transition-colors sm:w-auto"
            >
              Call (843) 555-1234
            </a>
            <Link
              href="/contact"
              className="w-full rounded border border-cream/30 px-6 py-3 font-semibold text-cream hover:border-tan hover:text-tan transition-colors sm:w-auto"
            >
              Send a Message
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
