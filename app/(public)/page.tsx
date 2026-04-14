import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import GoogleReviews from '@/components/public/GoogleReviews'

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
  { icon: 'gate', label: 'Electronic Gate Access', sub: '24/7 security monitoring' },
  { icon: 'climate', label: 'Climate Controlled', sub: 'Protect temperature-sensitive items' },
  { icon: 'phone', label: 'Manage Online', sub: 'Pay rent & get gate code from your phone' },
  { icon: 'truck', label: 'Drive-Up Units', sub: 'Load & unload with ease' },
  { icon: 'star', label: '5-Star Rated', sub: '100+ happy customers in Caryville' },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Choose Your Unit',
    body: 'Browse our available units online, filter by size and type, and pick the one that fits your needs and budget.',
    icon: 'search',
  },
  {
    step: '02',
    title: 'Join the Waiting List',
    body: "See a unit you love but it's taken? Join our waiting list and we'll notify you the moment it opens up.",
    icon: 'list',
  },
  {
    step: '03',
    title: 'Sign Your Lease',
    body: 'Our team will reach out to complete your move-in. Sign your lease digitally — no need to visit the office.',
    icon: 'pen',
  },
  {
    step: '04',
    title: 'Move In',
    body: 'Get your gate code, head to your unit, and start moving. Access your account anytime from our tenant portal.',
    icon: 'key',
  },
]

const FACILITY_PHOTOS = [
  { src: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=900&q=80', alt: 'Storage facility exterior', label: 'Climate Controlled' },
  { src: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&q=80', alt: 'Climate controlled hallway', label: 'Drive-Up Access' },
  { src: 'https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=500&q=80', alt: 'Drive-up units', label: '24/7 Security' },
  { src: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80', alt: 'Security gate', label: 'LED Lighting' },
  { src: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500&q=80', alt: 'Unit interior', label: 'Well Maintained' },
]

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100
  )
}

function TrustIcon({ type }: { type: string }) {
  const cls = "h-7 w-7 text-tan"
  switch (type) {
    case 'gate':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      )
    case 'climate':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )
    case 'phone':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      )
    case 'truck':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      )
    case 'star':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      )
    default:
      return null
  }
}

function StepIcon({ type }: { type: string }) {
  const cls = "h-6 w-6 text-tan"
  switch (type) {
    case 'search':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      )
    case 'list':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      )
    case 'pen':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      )
    case 'key':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      )
    default:
      return null
  }
}

export default async function HomePage() {
  const featuredUnits = await getFeaturedUnits()
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[85vh] overflow-hidden bg-brown">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&q=80"
            alt="Storage facility"
            fill
            className="object-cover"
            priority
          />
          {/* Gradient overlay instead of simple opacity */}
          <div className="absolute inset-0 bg-gradient-to-br from-brown/95 via-brown/80 to-brown-light/70" />
          {/* Grain texture */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />
        </div>

        {/* Decorative gold line */}
        <div className="absolute bottom-0 left-0 right-0 z-10 h-px bg-gradient-to-r from-transparent via-tan/40 to-transparent" />

        <div className="relative z-10 mx-auto flex min-h-[85vh] max-w-7xl items-center px-4 py-24 sm:px-6 lg:px-8">
          <div className="grid w-full grid-cols-1 items-center gap-16 lg:grid-cols-2">
            {/* Copy */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-tan/30 bg-tan/10 px-5 py-2 text-sm font-medium tracking-wide text-tan backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-tan animate-pulse" />
                Now accepting reservations in Caryville, TN
              </div>
              <h1 className="font-serif text-5xl font-bold leading-[1.1] text-cream sm:text-6xl lg:text-7xl">
                Storage you can
                <span className="block text-tan">trust.</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-cream/60">
                Climate-controlled, drive-up, and standard units. Secure electronic gate access.
                Manage everything online from your phone.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/units"
                  className="group relative rounded-lg bg-tan px-8 py-3.5 font-semibold text-brown transition-all duration-300 hover:bg-tan-light hover:shadow-lg hover:shadow-tan/20"
                >
                  View Available Units
                </Link>
                <Link
                  href="/size-guide"
                  className="rounded-lg border border-cream/20 px-8 py-3.5 font-semibold text-cream transition-all duration-300 hover:border-tan/60 hover:text-tan"
                >
                  Size Guide
                </Link>
              </div>
              <div className="flex items-center gap-5 pt-4">
                <div className="flex -space-x-2.5">
                  {['bg-tan', 'bg-olive', 'bg-muted', 'bg-brown-light'].map((c, i) => (
                    <div key={i} className={`h-9 w-9 rounded-full border-2 border-brown ${c} ring-1 ring-brown`} />
                  ))}
                </div>
                <div className="h-8 w-px bg-cream/15" />
                <p className="text-sm text-cream/50">
                  Trusted by <span className="font-semibold text-cream/80">100+ Caryville families</span>
                </p>
              </div>
            </div>

            {/* Quick info card — glassmorphism */}
            <div className="rounded-2xl border border-cream/[0.08] bg-cream/[0.04] p-10 shadow-2xl shadow-black/20 backdrop-blur-xl">
              {/* Subtle gold accent line at top */}
              <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-tan/50 to-transparent" />
              <h2 className="mb-8 font-serif text-2xl font-bold text-cream">
                Find Your Unit
              </h2>
              <div className="space-y-5">
                <div>
                  <label htmlFor="hero-size" className="mb-2 block text-sm font-medium tracking-wide text-cream/50 uppercase">
                    Unit Size
                  </label>
                  <select id="hero-size" className="w-full rounded-lg border border-cream/10 bg-brown-light/80 px-4 py-3 text-cream transition-colors focus:border-tan/50 focus:outline-none focus:ring-1 focus:ring-tan/30">
                    <option value="">Any size</option>
                    <option value="5x5">5x5 — Small (locker)</option>
                    <option value="5x10">5x10 — Small bedroom</option>
                    <option value="10x10">10x10 — Large bedroom</option>
                    <option value="10x15">10x15 — 1-2 bedroom apt</option>
                    <option value="10x20">10x20 — House contents</option>
                    <option value="10x30">10x30 — Large home</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="hero-type" className="mb-2 block text-sm font-medium tracking-wide text-cream/50 uppercase">
                    Unit Type
                  </label>
                  <select id="hero-type" className="w-full rounded-lg border border-cream/10 bg-brown-light/80 px-4 py-3 text-cream transition-colors focus:border-tan/50 focus:outline-none focus:ring-1 focus:ring-tan/30">
                    <option value="">Any type</option>
                    <option value="standard">Standard</option>
                    <option value="climate_controlled">Climate Controlled</option>
                    <option value="drive_up">Drive-Up</option>
                    <option value="vehicle_outdoor">Vehicle Storage</option>
                  </select>
                </div>
                <Link
                  href="/units"
                  id="hero-search-link"
                  className="mt-3 block w-full rounded-lg bg-tan py-3.5 text-center font-semibold text-brown transition-all duration-300 hover:bg-tan-light hover:shadow-lg hover:shadow-tan/20"
                >
                  Search Units
                  <svg className="ml-2 inline-block h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
              <p className="mt-5 text-center text-xs tracking-wide text-cream/30">
                No commitment required &middot; Move in as soon as tomorrow
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Bar ────────────────────────────────────────────────────── */}
      <section className="border-b border-mid/50 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {TRUST_ITEMS.map((item, idx) => (
              <div
                key={item.label}
                className={`flex flex-col items-center gap-3 px-6 py-8 text-center ${
                  idx < TRUST_ITEMS.length - 1 ? 'lg:border-r lg:border-mid/40' : ''
                } ${idx < 3 ? 'sm:border-r sm:border-mid/40' : ''} ${idx < 2 ? 'border-r border-mid/40' : ''}`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tan/[0.08]">
                  <TrustIcon type={item.icon} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-brown">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Facility Photos ──────────────────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            {/* Decorative element */}
            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="h-px w-12 bg-tan/40" />
              <div className="h-1.5 w-1.5 rounded-full bg-tan/60" />
              <div className="h-px w-12 bg-tan/40" />
            </div>
            <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl lg:text-5xl">
              A Facility You&apos;ll Feel Good About
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted">
              Clean, well-lit, and maintained to the highest standards.
              Every detail designed with your belongings in mind.
            </p>
          </div>

          {/* Photo grid with labels */}
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:h-[540px]">
            {/* Left — tall feature photo */}
            <div className="group relative h-64 overflow-hidden rounded-2xl sm:h-80 lg:h-full">
              <Image
                src={FACILITY_PHOTOS[0].src}
                alt={FACILITY_PHOTOS[0].alt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-brown/70 to-transparent" />
              <div className="absolute bottom-5 left-5">
                <span className="rounded-full border border-cream/20 bg-brown/50 px-4 py-1.5 text-sm font-medium text-cream backdrop-blur-sm">
                  {FACILITY_PHOTOS[0].label}
                </span>
              </div>
            </div>

            {/* Right — 2x2 grid */}
            <div className="grid grid-cols-2 grid-rows-2 gap-4 sm:gap-5 lg:h-full">
              {FACILITY_PHOTOS.slice(1).map((photo) => (
                <div key={photo.label} className="group relative h-36 overflow-hidden rounded-2xl sm:h-44 lg:h-full">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-brown/60 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <span className="rounded-full border border-cream/20 bg-brown/50 px-3 py-1 text-xs font-medium text-cream backdrop-blur-sm">
                      {photo.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Units Preview ────────────────────────────────────────────────── */}
      <section className="bg-cream py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 flex items-end justify-between">
            <div>
              {/* Decorative element */}
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px w-10 bg-tan/40" />
                <div className="h-1.5 w-1.5 rounded-full bg-tan/60" />
              </div>
              <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl lg:text-5xl">
                Available Units
              </h2>
              <p className="mt-3 max-w-2xl text-lg text-muted">
                {featuredUnits.length > 0
                  ? `Starting from ${formatMoney(Math.min(...featuredUnits.map((u) => u.price)))}/month. No hidden fees.`
                  : 'No hidden fees. Month-to-month.'}
              </p>
            </div>
            <Link
              href="/units"
              className="hidden items-center gap-1.5 text-sm font-semibold text-tan transition-colors hover:text-tan-light sm:flex"
            >
              View all units
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredUnits.map((unit) => {
              const available = unit.status === 'available'
              return (
                <div
                  key={unit._id.toString()}
                  className="group relative rounded-2xl border border-mid bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brown/[0.06]"
                >
                  {/* Top accent line */}
                  <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-tan/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="mb-5 flex items-start justify-between">
                    <div>
                      <p className="font-serif text-2xl font-bold text-brown">{unit.size}</p>
                      <p className="mt-0.5 text-xs text-muted">{unit.sqft} sq ft</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${available ? 'bg-olive/10 text-olive' : 'bg-muted/10 text-muted'}`}>
                      {available ? 'Available' : 'Waitlist'}
                    </span>
                  </div>

                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-tan">
                    {TYPE_LABELS[unit.type] ?? unit.type}
                  </p>

                  <ul className="mb-6 space-y-2">
                    {unit.features.slice(0, 3).map((f: string) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-muted">
                        <svg className="h-3.5 w-3.5 flex-shrink-0 text-olive" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Price — more prominent */}
                  <div className="mb-5 rounded-xl bg-cream/80 px-4 py-3">
                    <span className="font-serif text-2xl font-bold text-brown">{formatMoney(unit.price)}</span>
                    <span className="ml-1 text-sm text-muted">/mo</span>
                  </div>

                  <Link
                    href={`/units/${unit._id.toString()}`}
                    className={`block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-all duration-300 ${
                      available
                        ? 'bg-tan text-brown hover:bg-tan-light hover:shadow-md hover:shadow-tan/20'
                        : 'bg-mid text-muted hover:bg-mid/80'
                    }`}
                  >
                    {available ? 'View Unit' : 'Join Waitlist'}
                  </Link>
                </div>
              )
            })}
          </div>

          <div className="mt-10 text-center sm:hidden">
            <Link href="/units" className="inline-flex items-center gap-1.5 text-sm font-semibold text-tan hover:text-tan-light">
              View all units
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="bg-brown py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            {/* Decorative element */}
            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="h-px w-12 bg-tan/30" />
              <div className="h-1.5 w-1.5 rounded-full bg-tan/50" />
              <div className="h-px w-12 bg-tan/30" />
            </div>
            <h2 className="font-serif text-3xl font-bold text-cream sm:text-4xl lg:text-5xl">
              Simple from Day One
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-cream/50">
              From browsing to moving in — we make it effortless.
            </p>
          </div>

          <div className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {/* Horizontal connector line — desktop only */}
            <div className="absolute left-[calc(12.5%+24px)] right-[calc(12.5%+24px)] top-[28px] hidden h-px lg:block">
              <div className="h-full w-full border-t border-dashed border-tan/20" />
            </div>

            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="relative text-center lg:text-left">
                {/* Step circle with icon */}
                <div className="relative z-10 mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-tan/30 bg-brown-light shadow-lg shadow-black/20 lg:mx-0">
                  <StepIcon type={item.icon} />
                </div>
                {/* Step number */}
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tan/60">{item.step}</p>
                <h3 className="mb-3 font-serif text-xl font-semibold text-cream">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-cream/50">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reviews ──────────────────────────────────────────────────────── */}
      <GoogleReviews />

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brown py-24">
        {/* Background image with strong overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1553413077-190dd305871c?w=1600&q=60"
            alt=""
            fill
            loading="lazy"
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-brown/95 via-brown/90 to-brown-light/85" />
        </div>
        {/* Grain texture */}
        <div className="absolute inset-0 z-[1] opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />
        {/* Top gold line */}
        <div className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-tan/30 to-transparent" />

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          {/* Decorative element */}
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-tan/30" />
            <div className="h-2 w-2 rounded-full bg-tan/40" />
            <div className="h-px w-16 bg-tan/30" />
          </div>
          <h2 className="font-serif text-3xl font-bold text-cream sm:text-4xl lg:text-5xl">
            Ready to Get Started?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-cream/50">
            Units fill fast. Join our waiting list today and be first to know when
            a unit that fits your needs becomes available.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/units"
              className="w-full rounded-lg bg-tan px-10 py-4 font-semibold text-brown transition-all duration-300 hover:bg-tan-light hover:shadow-lg hover:shadow-tan/20 sm:w-auto"
            >
              Browse Units
            </Link>
            <Link
              href="/waiting-list"
              className="w-full rounded-lg border border-cream/20 px-10 py-4 font-semibold text-cream transition-all duration-300 hover:border-tan/50 hover:text-tan sm:w-auto"
            >
              Join Waiting List
            </Link>
          </div>
          <p className="mt-8 text-sm text-cream/30">
            Questions?{' '}
            <a href="tel:+18654262100" className="font-medium text-cream/50 underline decoration-cream/20 underline-offset-2 transition-colors hover:text-tan">
              Call us at (865) 426-2100
            </a>
          </p>
        </div>
      </section>
    </>
  )
}
