import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Map & Directions | Tuscany Village Self Storage',
  description: 'Find Tuscany Village Self Storage at 2519 Highway 116, Caryville, TN 37714. Get directions and hours.',
}

export default function MapPage() {
  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden bg-brown py-16 sm:py-24">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-tan" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-tan" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
              Find Us
            </p>
            <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl lg:text-6xl">
              Map &amp; Directions
            </h1>
            <p className="mt-4 text-lg text-cream/50">
              2519 Highway 116, Caryville, TN 37714 &bull; Gate access 24/7
            </p>
          </div>
        </div>
      </div>

      <div className="bg-cream">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">

          {/* Map embed */}
          <div className="mb-10 overflow-hidden rounded-2xl border border-mid/60 shadow-lg shadow-brown/[0.06]">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3229.5!2d-84.223!3d36.297!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2s2519+Highway+116+Caryville+TN+37714!5e0!3m2!1sen!2sus!4v1"
              width="100%"
              height="480"
              style={{ border: 0, display: 'block' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Tuscany Village Self Storage — 2519 Highway 116, Caryville, TN"
            />
          </div>

          {/* Info grid */}
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Address */}
            <div className="rounded-2xl border border-mid/60 bg-white p-7 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-tan/10">
                <svg className="h-6 w-6 text-tan" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Address</p>
              <p className="font-serif text-lg font-bold text-brown">2519 Highway 116</p>
              <p className="text-muted">Caryville, TN 37714</p>
              <a
                href="https://www.google.com/maps/search/?api=1&query=2519+Highway+116+Caryville+TN+37714"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-tan transition-colors hover:text-brown hover:underline"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
                Get Directions
              </a>
            </div>

            {/* Phone */}
            <div className="rounded-2xl border border-mid/60 bg-white p-7 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-olive/10">
                <svg className="h-6 w-6 text-olive" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Phone</p>
              <p className="font-serif text-lg font-bold text-brown">(865) 426-2100</p>
              <p className="text-muted">Office &amp; inquiries</p>
              <a
                href="tel:+18654262100"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-olive transition-colors hover:text-brown hover:underline"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                Call Now
              </a>
            </div>

            {/* Hours */}
            <div className="overflow-hidden rounded-2xl bg-brown p-7 shadow-lg shadow-brown/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cream/10">
                <svg className="h-6 w-6 text-tan" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-cream/50">Hours</p>
              <p className="font-serif text-lg font-bold text-cream">Gate: 24/7 Access</p>
              <p className="text-cream/60">Office: By Appointment</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-olive opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-olive" />
                </span>
                <p className="text-xs text-cream/50">Fully automated facility</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 rounded-2xl border border-mid/60 bg-white p-8 text-center shadow-sm">
            <h2 className="font-serif text-2xl font-bold text-brown">Ready to rent?</h2>
            <p className="mx-auto mt-3 max-w-md text-muted">
              Browse available units and reserve online in minutes — no office visit required.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/units"
                className="rounded-full bg-tan px-8 py-3 font-semibold text-brown shadow-md shadow-tan/20 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                Browse Units
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-mid px-8 py-3 font-semibold text-brown transition-all hover:border-tan/40 hover:shadow-sm"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
