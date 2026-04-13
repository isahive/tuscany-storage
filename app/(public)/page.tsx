import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'

export const metadata: Metadata = {
  title: 'Tuscany Village Self Storage | Caryville, TN',
  description:
    'Safe, clean, and affordable storage units in Caryville, TN. Climate-controlled, drive-up, and vehicle storage. Reserve online today.',
}

const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle Storage',
}

async function getFeaturedUnits() {
  try {
    await connectDB()
    const units = await Unit.find({})
      .sort({ price: 1 })
      .limit(4)
      .lean()
    return units
  } catch {
    return []
  }
}

const TRUST_ITEMS = [
  { icon: '🔒', label: 'Electronic Gate Access', sub: '24/7 security monitoring' },
  { icon: '🌡️', label: 'Climate Controlled', sub: 'Protect temperature-sensitive items' },
  { icon: '📱', label: 'Manage Online', sub: 'Pay rent & get gate code from your phone' },
  { icon: '🚚', label: 'Drive-Up Units', sub: 'Load & unload with ease' },
  { icon: '⭐', label: '5-Star Rated', sub: '100+ happy customers in Caryville' },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Choose Your Unit',
    body: 'Browse our available units online, filter by size and type, and pick the one that fits your needs and budget.',
  },
  {
    step: '02',
    title: 'Join the Waiting List',
    body: "See a unit you love but it's taken? Join our waiting list and we'll notify you the moment it opens up.",
  },
  {
    step: '03',
    title: 'Sign Your Lease',
    body: 'Our team will reach out to complete your move-in. Sign your lease digitally — no need to visit the office.',
  },
  {
    step: '04',
    title: 'Move In',
    body: 'Get your gate code, head to your unit, and start moving. Access your account anytime from our tenant portal.',
  },
]

const REVIEWS = [
  {
    name: 'Sarah M.',
    rating: 5,
    text: 'Clean, safe, and the staff is incredibly helpful. I\'ve stored here for 2 years and wouldn\'t go anywhere else.',
  },
  {
    name: 'James T.',
    rating: 5,
    text: 'The climate-controlled unit kept all my furniture in perfect condition during our home renovation. Worth every penny.',
  },
  {
    name: 'Linda R.',
    rating: 5,
    text: 'Online bill pay makes it so easy. I barely have to think about it. Great facility with great prices.',
  },
]

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100
  )
}

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="h-4 w-4 text-tan" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default async function HomePage() {
  const featuredUnits = await getFeaturedUnits()
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brown">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&q=80"
            alt="Storage facility"
            fill
            className="object-cover opacity-20"
            priority
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            {/* Copy */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-tan/30 bg-tan/10 px-4 py-1.5 text-sm font-medium text-tan">
                <span className="h-2 w-2 rounded-full bg-tan animate-pulse" />
                Now accepting reservations in Caryville, TN
              </div>
              <h1 className="font-serif text-4xl font-bold leading-tight text-cream sm:text-5xl lg:text-6xl">
                Storage you can
                <span className="block text-tan">trust.</span>
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-cream/70">
                Climate-controlled, drive-up, and standard units. Secure electronic gate access.
                Manage everything online from your phone.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/units"
                  className="rounded bg-tan px-6 py-3 font-semibold text-brown hover:bg-tan-light transition-colors"
                >
                  View Available Units
                </Link>
                <Link
                  href="/size-guide"
                  className="rounded border border-cream/30 px-6 py-3 font-semibold text-cream hover:border-tan hover:text-tan transition-colors"
                >
                  Size Guide
                </Link>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex -space-x-2">
                  {['bg-tan', 'bg-olive', 'bg-muted', 'bg-brown-light'].map((c, i) => (
                    <div key={i} className={`h-8 w-8 rounded-full border-2 border-brown ${c}`} />
                  ))}
                </div>
                <p className="text-sm text-cream/60">
                  Trusted by <span className="font-semibold text-cream">100+ Caryville families</span>
                </p>
              </div>
            </div>

            {/* Quick info card */}
            <div className="rounded-2xl border border-cream/10 bg-cream/5 p-8 backdrop-blur-sm">
              <h2 className="mb-6 font-serif text-2xl font-bold text-cream">
                Find Your Unit
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-cream/70">
                    Unit Size
                  </label>
                  <select className="w-full rounded border border-cream/20 bg-brown-light px-3 py-2.5 text-cream focus:border-tan focus:outline-none">
                    <option value="">Any size</option>
                    <option value="5x5">5×5 — Small (locker)</option>
                    <option value="5x10">5×10 — Small bedroom</option>
                    <option value="10x10">10×10 — Large bedroom</option>
                    <option value="10x15">10×15 — 1–2 bedroom apt</option>
                    <option value="10x20">10×20 — House contents</option>
                    <option value="10x30">10×30 — Large home</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-cream/70">
                    Unit Type
                  </label>
                  <select className="w-full rounded border border-cream/20 bg-brown-light px-3 py-2.5 text-cream focus:border-tan focus:outline-none">
                    <option value="">Any type</option>
                    <option value="standard">Standard</option>
                    <option value="climate_controlled">Climate Controlled</option>
                    <option value="drive_up">Drive-Up</option>
                    <option value="vehicle_outdoor">Vehicle Storage</option>
                  </select>
                </div>
                <Link
                  href="/units"
                  className="mt-2 block w-full rounded bg-tan py-3 text-center font-semibold text-brown hover:bg-tan-light transition-colors"
                >
                  Search Units →
                </Link>
              </div>
              <p className="mt-4 text-center text-xs text-cream/40">
                No commitment required · Move in as soon as tomorrow
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Bar ────────────────────────────────────────────────────── */}
      <section className="border-b border-mid bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 divide-x divide-mid sm:grid-cols-3 lg:grid-cols-5">
            {TRUST_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-2 px-4 py-6 text-center"
              >
                <span className="text-2xl">{item.icon}</span>
                <p className="text-sm font-semibold text-brown">{item.label}</p>
                <p className="text-xs text-muted">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Facility photos ───────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
              A Facility You&apos;ll Feel Good About
            </h2>
            <p className="mt-3 text-muted">
              Clean, well-lit, and maintained to the highest standards.
            </p>
          </div>
          {/* Outer grid: left hero | right 2×2. Fixed height on lg so every cell fills flush. */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 lg:h-[520px]">
            {/* Left — tall feature photo */}
            <div className="relative h-64 overflow-hidden rounded-xl sm:h-80 lg:h-full">
              <Image
                src="https://images.unsplash.com/photo-1553413077-190dd305871c?w=900&q=80"
                alt="Storage facility exterior"
                fill
                className="object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>

            {/* Right — 2 columns × 2 rows, all cells equal height */}
            <div className="grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4 lg:h-full">
              <div className="relative h-36 overflow-hidden rounded-xl sm:h-44 lg:h-full">
                <Image
                  src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&q=80"
                  alt="Climate controlled hallway"
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
              <div className="relative h-36 overflow-hidden rounded-xl sm:h-44 lg:h-full">
                <Image
                  src="https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=500&q=80"
                  alt="Drive-up units"
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
              <div className="relative h-36 overflow-hidden rounded-xl sm:h-44 lg:h-full">
                <Image
                  src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80"
                  alt="Security gate"
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
              <div className="relative h-36 overflow-hidden rounded-xl sm:h-44 lg:h-full">
                <Image
                  src="https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500&q=80"
                  alt="Unit interior"
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Units Preview ────────────────────────────────────────────────── */}
      <section className="bg-cream py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
                Available Units
              </h2>
              <p className="mt-2 text-muted">
              {featuredUnits.length > 0
                ? `Starting from ${formatMoney(Math.min(...featuredUnits.map((u) => u.price)))}/month. No hidden fees.`
                : 'No hidden fees. Month-to-month.'}
            </p>
            </div>
            <Link
              href="/units"
              className="hidden text-sm font-semibold text-tan hover:underline sm:block"
            >
              View all units →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredUnits.map((unit) => {
              const available = unit.status === 'available'
              return (
                <div
                  key={unit._id.toString()}
                  className="rounded-xl border border-mid bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <p className="font-serif text-2xl font-bold text-brown">{unit.size}</p>
                      <p className="text-xs text-muted">{unit.sqft} sq ft</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${available ? 'bg-olive/10 text-olive' : 'bg-muted/10 text-muted'}`}>
                      {available ? 'Available' : 'Waitlist'}
                    </span>
                  </div>

                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-tan">
                    {TYPE_LABELS[unit.type] ?? unit.type}
                  </p>

                  <ul className="mb-5 space-y-1">
                    {unit.features.slice(0, 3).map((f: string) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-muted">
                        <svg className="h-3.5 w-3.5 flex-shrink-0 text-olive" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-serif text-xl font-bold text-brown">{formatMoney(unit.price)}</span>
                      <span className="text-xs text-muted">/mo</span>
                    </div>
                    <Link
                      href={`/units/${unit._id.toString()}`}
                      className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${available ? 'bg-tan text-brown hover:bg-tan-light' : 'bg-mid text-muted hover:bg-mid/80'}`}
                    >
                      {available ? 'View Unit' : 'Waitlist'}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link href="/units" className="text-sm font-semibold text-tan hover:underline">
              View all units →
            </Link>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="bg-brown py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="font-serif text-3xl font-bold text-cream sm:text-4xl">
              Simple from Day One
            </h2>
            <p className="mt-3 text-cream/60">
              From browsing to moving in — we make it effortless.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item, idx) => (
              <div key={item.step} className="relative">
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div className="absolute right-0 top-6 hidden h-px w-full translate-x-1/2 border-t border-dashed border-tan/20 lg:block" />
                )}
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-tan/30 bg-tan/10">
                  <span className="font-serif text-lg font-bold text-tan">{item.step}</span>
                </div>
                <h3 className="mb-2 font-serif text-lg font-semibold text-cream">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-cream/60">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reviews ──────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
              What Our Customers Say
            </h2>
            <div className="mt-3 flex items-center justify-center gap-2">
              <StarRating count={5} />
              <span className="text-sm font-medium text-brown">
                5.0 — 100+ reviews on Google
              </span>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {REVIEWS.map((r) => (
              <div
                key={r.name}
                className="rounded-xl border border-mid bg-white p-6 shadow-sm"
              >
                <StarRating count={r.rating} />
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  &ldquo;{r.text}&rdquo;
                </p>
                <p className="mt-4 text-sm font-semibold text-brown">{r.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-tan py-16">
        <div className="absolute inset-0 z-0 opacity-10">
          <Image
            src="https://images.unsplash.com/photo-1553413077-190dd305871c?w=1600&q=60"
            alt=""
            fill
            className="object-cover"
          />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
            Ready to Get Started?
          </h2>
          <p className="mt-4 text-lg text-brown/70">
            Units fill fast. Join our waiting list today and be first to know when
            a unit that fits your needs becomes available.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/units"
              className="w-full rounded bg-brown px-8 py-3 font-semibold text-cream hover:bg-brown-light transition-colors sm:w-auto"
            >
              Browse Units
            </Link>
            <Link
              href="/waiting-list"
              className="w-full rounded border-2 border-brown px-8 py-3 font-semibold text-brown hover:bg-brown/5 transition-colors sm:w-auto"
            >
              Join Waiting List
            </Link>
          </div>
          <p className="mt-4 text-sm text-brown/60">
            Questions?{' '}
            <a href="tel:+18654262100" className="font-medium underline hover:text-brown">
              Call us at (865) 426-2100
            </a>
          </p>
        </div>
      </section>
    </>
  )
}
