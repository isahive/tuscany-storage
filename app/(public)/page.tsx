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
    const all = await Unit.find({}).sort({ price: 1 }).lean()
    const seen = new Set<string>()
    const units = []
    for (const u of all) {
      const key = (u.size as string).toLowerCase().replace(/\s+/g, '')
      if (!seen.has(key)) {
        seen.add(key)
        units.push(u)
        if (units.length === 4) break
      }
    }
    return units
  } catch {
    return []
  }
}

const TRUST_ITEMS = [
  { icon: 'ada', label: 'ADA Compliant', sub: 'Accessible units available' },
  { icon: 'truck', label: 'Drive-up Access', sub: 'Load & unload with ease' },
  { icon: 'fence', label: 'Fenced & Gated', sub: 'Perimeter secured 24/7' },
  { icon: 'camera', label: 'Digital Video Surveillance', sub: 'Recorded coverage' },
  { icon: 'shield', label: 'Onsite Security', sub: 'Active monitoring' },
  { icon: 'phone', label: 'Online Bill Pay', sub: 'Pay rent from your phone' },
  { icon: 'sizes', label: 'Variety of Unit Sizes', sub: '5x10 up to 10x30' },
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

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100
  )
}

function TrustIcon({ type }: { type: string }) {
  const cls = "h-7 w-7 text-tan"
  switch (type) {
    case 'ada':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <circle cx="12" cy="4" r="1.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7.5h6l-1.2 4.5h4.2L20 19m-7-7l-1 7m-1-7H8.5l-2 5.5" />
        </svg>
      )
    case 'truck':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      )
    case 'fence':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V8l3-3 3 3v2h3V8l3-3 3 3v13M3 14h18M3 17.5h18" />
        </svg>
      )
    case 'camera':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
      )
    case 'shield':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9c0-1.605.42-3.113 1.157-4.418A8.969 8.969 0 0112 3a8.969 8.969 0 017.843 4.582A8.967 8.967 0 0121 12z" />
        </svg>
      )
    case 'phone':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      )
    case 'sizes':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
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
        {/* Layered gradient background — no photo, to match the live site's minimal aesthetic */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-brown via-brown to-brown-light/80" />
          {/* Radial glow accent */}
          <div className="absolute right-[-200px] top-[-200px] h-[500px] w-[500px] rounded-full bg-tan/10 blur-3xl" />
          <div className="absolute bottom-[-150px] left-[-100px] h-[400px] w-[400px] rounded-full bg-olive/10 blur-3xl" />
          {/* Grain texture */}
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
            {TRUST_ITEMS.map((item, idx) => (
              <div
                key={item.label}
                className={`flex flex-col items-center gap-3 px-4 py-8 text-center ${
                  idx < TRUST_ITEMS.length - 1 ? 'lg:border-r lg:border-mid/40' : ''
                } ${idx < 3 ? 'sm:border-r sm:border-mid/40' : ''} ${idx % 2 === 0 ? 'border-r border-mid/40 sm:border-r-0' : ''} ${idx < 2 ? 'sm:border-r sm:border-mid/40' : ''}`}
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
        {/* Gradient + glow accents — no photo */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-brown via-brown to-brown-light/80" />
          <div className="absolute left-1/2 top-[-150px] h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-tan/10 blur-3xl" />
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
