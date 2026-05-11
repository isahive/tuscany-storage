import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tenant Protection',
  description:
    'Protect your stored belongings against burglary, vandalism, weather, fire, and more. Affordable monthly plans from $12.',
}

const PLANS = [
  { coverage: '$2,000', price: '$12.00' },
  { coverage: '$3,000', price: '$15.00' },
  { coverage: '$5,000', price: '$20.00' },
  { coverage: '$10,000', price: '$33.00' },
  { coverage: '$15,000', price: '$42.00' },
]

const COVERED = [
  'Burglary / Vandalism',
  'Wind',
  'Lightning',
  'Hail',
  'Water (excluding flood)',
  'Fire',
  'Smoke',
  'Explosion',
  'Vermin (capped at $500)',
  'Sinkhole',
  'Building Collapse',
]

const REASONS = [
  {
    title: 'Homeowners may not cover stored items',
    body: "Many homeowners' policies exclude or limit coverage for belongings stored away from your primary residence.",
  },
  {
    title: 'Claims can raise your premium',
    body: 'Filing a claim against your homeowners or renters policy could result in higher premiums at your next renewal.',
  },
  {
    title: 'Claims can trigger cancellation',
    body: 'In some cases, a claim could lead your home insurance carrier to cancel or non-renew your policy.',
  },
]

const CLAIM_STEPS = [
  { n: '01', title: 'Notify the manager', body: 'Reach out to Tuscany Village so we can document the incident on our end.' },
  { n: '02', title: 'Document the damage', body: 'Take photos of the damage and preserve all affected items pending specialist review.' },
  { n: '03', title: 'File the claim', body: 'Submit the claim online or call 833-682-8879.' },
  { n: '04', title: 'Police report (if applicable)', body: "For burglary or vandalism, obtain a police report and request the officer visit the unit." },
]

export default function TenantProtectionPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brown py-24 sm:py-28">
        <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }} />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-tan/40 to-transparent" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-tan/40" />
            <div className="h-1.5 w-1.5 rounded-full bg-tan/60" />
            <div className="h-px w-12 bg-tan/40" />
          </div>
          <h1 className="font-serif text-4xl font-bold leading-tight text-cream sm:text-5xl lg:text-6xl">
            Protect your storage against{' '}
            <span className="text-tan">the unexpected.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-cream/60">
            Affordable monthly protection plans for your stored belongings — starting at just $12/month.
            Add tenant protection when you rent, or any time from your online account.
          </p>
        </div>
      </section>

      {/* Why tenant protection */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-tan">Why Choose Tenant Protection</p>
            <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
              Better than relying on your homeowner&apos;s policy
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {REASONS.map((r, idx) => (
              <div key={r.title} className="rounded-2xl border border-mid bg-cream/40 p-7">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-tan/15 text-sm font-semibold text-brown">
                  {idx + 1}
                </div>
                <h3 className="mb-2 font-serif text-lg font-semibold text-brown">{r.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage plans */}
      <section className="bg-cream py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-tan">Coverage Plans</p>
            <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
              Choose the coverage that fits
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
              Five tiers from $2,000 up to $15,000 in coverage. Cancel or change anytime.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-mid bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-brown text-cream">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em]">
                    Coverage Amount
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em]">
                    Monthly Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {PLANS.map((plan, idx) => (
                  <tr
                    key={plan.coverage}
                    className={`border-t border-mid/60 ${idx % 2 === 0 ? 'bg-white' : 'bg-cream/30'}`}
                  >
                    <td className="px-6 py-5">
                      <span className="font-serif text-2xl font-bold text-brown">{plan.coverage}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="font-serif text-xl font-semibold text-tan">{plan.price}</span>
                      <span className="ml-1 text-sm text-muted">/mo</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-xl border-l-4 border-tan bg-tan/5 px-5 py-4">
            <p className="text-sm leading-relaxed text-brown">
              <strong className="font-semibold">Lock requirement:</strong> Be sure to use a disc or
              cylinder lock to avoid the $200 deductible.
            </p>
          </div>
        </div>
      </section>

      {/* What's covered */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-tan">What&apos;s Covered</p>
            <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
              Protection against the most common risks
            </h2>
          </div>
          <ul className="mx-auto grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
            {COVERED.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-lg border border-mid/60 bg-cream/30 px-5 py-3.5"
              >
                <svg
                  className="h-5 w-5 flex-shrink-0 text-olive"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="text-sm font-medium text-brown">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Claims process */}
      <section className="bg-brown py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-tan">Filing a Claim</p>
            <h2 className="font-serif text-3xl font-bold text-cream sm:text-4xl">
              Simple, supported, and on your side
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CLAIM_STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-2xl border border-cream/10 bg-cream/[0.04] p-7 backdrop-blur-sm"
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-tan/70">
                  {step.n}
                </p>
                <h3 className="mb-2 font-serif text-lg font-semibold text-cream">{step.title}</h3>
                <p className="text-sm leading-relaxed text-cream/55">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-tan/30 bg-tan/[0.06] p-6 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-tan">Claims Hotline</p>
            <a
              href="tel:8336828879"
              className="mt-2 inline-block font-serif text-3xl font-bold text-cream hover:text-tan transition-colors"
            >
              833-682-8879
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-cream py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
            Ready to add protection?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
            Add tenant protection when you rent a unit, or any time from your online account.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/units"
              className="w-full rounded-lg bg-tan px-10 py-4 font-semibold text-brown transition-all duration-300 hover:bg-tan-light hover:shadow-lg hover:shadow-tan/20 sm:w-auto"
            >
              Rent a Unit
            </Link>
            <Link
              href="/portal"
              className="w-full rounded-lg border border-brown/20 px-10 py-4 font-semibold text-brown transition-all duration-300 hover:border-tan hover:text-tan sm:w-auto"
            >
              Manage Existing Rental
            </Link>
          </div>
          <p className="mt-8 text-sm text-muted">
            Questions?{' '}
            <a
              href="tel:+18654262100"
              className="font-medium text-brown underline decoration-mid underline-offset-2 transition-colors hover:text-tan"
            >
              Call us at (865) 426-2100
            </a>
          </p>
        </div>
      </section>
    </>
  )
}
