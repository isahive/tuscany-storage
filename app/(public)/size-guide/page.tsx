import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Storage Size Guide',
  description: 'Not sure what size storage unit you need? Use our size guide to find the perfect fit at Tuscany Village Self Storage.',
}

const SIZES = [
  {
    size: '5\u00d75',
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
    color: 'olive',
  },
  {
    size: '5\u00d710',
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
    color: 'olive',
  },
  {
    size: '10\u00d710',
    sqft: 100,
    analogy: 'Standard Bedroom',
    price: 8500,
    fits: [
      '1-bedroom apartment contents',
      'Queen bedroom set',
      'Couch + loveseat',
      'Washer and dryer',
      'Dining set',
      '10\u201315 boxes',
    ],
    notFits: ['Full 2-bedroom home contents'],
    bestFor: 'Our most popular size. Perfect for 1-bedroom apartments and downsizing.',
    popular: true,
    color: 'tan',
  },
  {
    size: '10\u00d715',
    sqft: 150,
    analogy: '1\u00bd Bedrooms',
    price: 13500,
    fits: [
      '1\u20132 bedroom apartment contents',
      'Multiple bedroom sets',
      'Large appliances',
      'Patio furniture',
      'Outdoor equipment',
    ],
    notFits: ['3+ bedroom homes'],
    bestFor: 'Larger apartments or storing contents from a 1\u20132 bedroom home during renovation.',
    color: 'tan',
  },
  {
    size: '10\u00d720',
    sqft: 200,
    analogy: '2-Car Garage',
    price: 16500,
    fits: [
      '2\u20133 bedroom home contents',
      'Full living room set',
      'Multiple bedroom sets',
      'Large appliances',
      'Business inventory',
    ],
    notFits: ['Very large homes (4+ bedrooms)'],
    bestFor: 'Storing the full contents of a 2\u20133 bedroom home or a small business.',
    color: 'brown',
  },
  {
    size: '10\u00d730',
    sqft: 300,
    analogy: 'Large Garage + Extra',
    price: 22000,
    fits: [
      '4\u20135 bedroom home contents',
      'Large vehicles',
      'Commercial equipment',
      'Business inventory',
      'Construction materials',
    ],
    notFits: [],
    bestFor: 'Our largest unit. Great for large homes, contractors, or businesses.',
    color: 'brown',
  },
]

const TYPES = [
  {
    type: 'Standard',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    description: 'Indoor or outdoor units without climate control. Great for items that can withstand temperature fluctuations.',
    bestFor: ['Furniture', 'Clothing', 'Boxes', 'Tools'],
    accent: 'bg-muted/10 text-muted border-muted/20',
  },
  {
    type: 'Climate Controlled',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      </svg>
    ),
    description: 'Temperature and humidity regulated (65\u201380\u00b0F year-round). Protects sensitive items from heat, cold, and moisture.',
    bestFor: ['Electronics', 'Artwork & antiques', 'Documents', 'Wine', 'Musical instruments'],
    accent: 'bg-tan/10 text-tan border-tan/20',
  },
  {
    type: 'Drive-Up',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.143-.504 1.125-1.125a17.902 17.902 0 00-3.213-9.174L15.443 4.68a3.375 3.375 0 00-2.818-1.518H7.5v10.5h9V4.68" />
      </svg>
    ),
    description: 'Pull your vehicle right up to the unit door. No carrying items through hallways.',
    bestFor: ['Heavy furniture', 'Appliances', 'Frequent access', 'Business inventory'],
    accent: 'bg-olive/10 text-olive border-olive/20',
  },
  {
    type: 'Vehicle Storage',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.143-.504 1.125-1.125a17.902 17.902 0 00-3.213-9.174L15.443 4.68" />
      </svg>
    ),
    description: 'Outdoor gated spaces for cars, trucks, boats, trailers, or RVs.',
    bestFor: ['Seasonal vehicles', 'Boats', 'RVs', 'Trailers', 'Classic cars'],
    accent: 'bg-brown/5 text-brown border-brown/10',
  },
]

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

/* Color bar classes for size cards */
const COLOR_BARS: Record<string, string> = {
  olive: 'bg-olive',
  tan: 'bg-tan',
  brown: 'bg-brown',
}

export default function SizeGuidePage() {
  return (
    <>
      {/* Hero header */}
      <div className="relative overflow-hidden bg-brown py-16 sm:py-24">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-tan" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-tan" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
              Find the Right Fit
            </p>
            <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl lg:text-6xl">
              Size Guide
            </h1>
            <p className="mt-4 text-lg text-cream/50">
              Choose the right unit the first time. Here&apos;s a detailed breakdown of what fits in each size.
            </p>
          </div>
        </div>
      </div>

      {/* Unit types */}
      <div className="border-b border-mid bg-cream py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
              Storage Options
            </p>
            <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
              Unit Types
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TYPES.map((t) => (
              <div
                key={t.type}
                className="group rounded-2xl border border-mid/60 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-brown/[0.06]"
              >
                <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl border ${t.accent}`}>
                  {t.icon}
                </div>
                <h3 className="mb-2 text-lg font-bold text-brown">{t.type}</h3>
                <p className="mb-5 text-sm leading-relaxed text-muted">{t.description}</p>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-tan">Best for</p>
                  <ul className="space-y-1.5">
                    {t.bestFor.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-tan/60" />
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
      <div className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
              Compare Sizes
            </p>
            <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
              Sizes at a Glance
            </h2>
          </div>

          <div className="space-y-5">
            {SIZES.map((s) => (
              <div
                key={s.size}
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brown/[0.06] ${
                  s.popular
                    ? 'border-tan/40 bg-white shadow-md shadow-tan/10'
                    : 'border-mid/60 bg-white shadow-sm'
                }`}
              >
                {/* Color accent bar */}
                <div className={`absolute left-0 top-0 h-full w-1 ${COLOR_BARS[s.color] ?? 'bg-mid'}`} />

                <div className="p-7 pl-8">
                  {s.popular && (
                    <div className="mb-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-tan px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brown shadow-sm">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="grid gap-8 lg:grid-cols-4">
                    {/* Size info */}
                    <div>
                      <div className="flex items-baseline gap-3">
                        <p className="font-serif text-4xl font-bold text-brown">{s.size}</p>
                        <p className="text-sm text-muted">{s.sqft} sq ft</p>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-tan">{s.analogy}</p>
                      <p className="mt-3 text-sm leading-relaxed text-muted">{s.bestFor}</p>
                      <div className="mt-5">
                        <span className="font-serif text-2xl font-bold text-brown">
                          {formatMoney(s.price)}
                        </span>
                        <span className="ml-1 text-sm text-muted">/mo</span>
                      </div>
                    </div>

                    {/* Visual block */}
                    <div className="flex items-center justify-center lg:col-span-1">
                      <div
                        className="rounded-xl border-2 border-dashed border-tan/30 bg-gradient-to-br from-tan/5 to-tan/10 transition-all duration-300 group-hover:border-tan/50 group-hover:shadow-md group-hover:shadow-tan/10"
                        style={{
                          width: `${Math.min(s.sqft * 0.5 + 40, 160)}px`,
                          height: `${Math.min(s.sqft * 0.3 + 40, 100)}px`,
                        }}
                      >
                        <div className="flex h-full flex-col items-center justify-center gap-0.5">
                          <span className="text-sm font-bold text-tan/80">{s.size}</span>
                          <span className="text-[10px] text-tan/50">{s.sqft} sq ft</span>
                        </div>
                      </div>
                    </div>

                    {/* Fits */}
                    <div>
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-olive">
                        What fits
                      </p>
                      <ul className="space-y-2">
                        {s.fits.map((item) => (
                          <li key={item} className="flex items-center gap-2 text-sm text-muted">
                            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-olive/10">
                              <svg className="h-2.5 w-2.5 text-olive" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Not fits + action */}
                    <div className="flex flex-col justify-between">
                      {s.notFits.length > 0 && (
                        <div>
                          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                            Might not fit
                          </p>
                          <ul className="space-y-2">
                            {s.notFits.map((item) => (
                              <li key={item} className="flex items-center gap-2 text-sm text-muted/70">
                                <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-muted/10">
                                  <svg className="h-2.5 w-2.5 text-muted/50" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Link
                        href="/units"
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-brown px-6 py-2.5 text-sm font-semibold text-cream transition-all duration-200 hover:-translate-y-0.5 hover:bg-tan hover:text-brown hover:shadow-md"
                      >
                        See {s.size} units
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Help CTA */}
      <div className="relative overflow-hidden bg-brown py-16 sm:py-20">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tan" />
        </div>
        <div className="relative mx-auto max-w-xl px-4 text-center">
          <h2 className="font-serif text-3xl font-bold text-cream sm:text-4xl">Still not sure?</h2>
          <p className="mt-4 text-cream/50">
            Give us a call or send a message. We&apos;ll help you pick the right size based on what you need to store.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="tel:+18654262100"
              className="w-full rounded-full bg-tan px-10 py-3.5 font-semibold text-brown shadow-md shadow-tan/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-tan-light hover:shadow-lg sm:w-auto"
            >
              Call (865) 426-2100
            </a>
            <Link
              href="/contact"
              className="w-full rounded-full border border-cream/20 px-10 py-3.5 font-semibold text-cream transition-all duration-200 hover:-translate-y-0.5 hover:border-tan hover:text-tan sm:w-auto"
            >
              Send a Message
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
