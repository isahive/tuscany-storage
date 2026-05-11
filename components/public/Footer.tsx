import Link from 'next/link'
import Image from 'next/image'

const FOOTER_LINKS = {
  'Storage': [
    { label: 'Units & Pricing', href: '/units' },
    { label: 'Size Guide', href: '/size-guide' },
    { label: 'Climate Controlled', href: '/units?type=climate_controlled' },
    { label: 'Drive-Up Access', href: '/units?type=drive_up' },
    { label: 'Vehicle Storage', href: '/units?type=vehicle_outdoor' },
  ],
  'Company': [
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Tenant Protection', href: '/tenant-protection' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contact Us', href: '/contact' },
    { label: 'Waiting List', href: '/waiting-list' },
  ],
  'Account': [
    { label: 'Tenant Login', href: '/portal' },
    { label: 'Pay Rent Online', href: '/portal/payments' },
    { label: 'Gate Code', href: '/portal/gate-code' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-brown text-cream">
      {/* Decorative gradient top border */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-tan to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column — spans 2 cols on large */}
          <div className="space-y-6 lg:col-span-2">
            <div>
              <Image
                src="/images/brand/logo.png"
                alt="Tuscany Village Self Storage"
                width={220}
                height={70}
                className="h-14 w-auto object-contain"
              />
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-cream/60">
              We are a fully automated company. Clean, secure, and conveniently
              located in Caryville with 24/7 gate access.
            </p>
            <div className="space-y-2 text-sm text-cream/60">
              <p>2519 Highway 116</p>
              <p>Caryville, TN 37714</p>
              <a
                href="tel:+18654262100"
                className="flex items-center gap-2 hover:text-tan transition-colors duration-200"
              >
                <svg className="h-4 w-4 text-tan/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                (865) 426-2100
              </a>
              <a
                href="mailto:Tuscanystorage@gmail.com"
                className="flex items-center gap-2 hover:text-tan transition-colors duration-200"
              >
                <svg className="h-4 w-4 text-tan/60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                Tuscanystorage@gmail.com
              </a>
              <a
                href="https://www.yelp.com/biz/tuscany-village-self-storage-caryville"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm hover:text-tan transition-colors duration-200"
                aria-label="Yelp"
              >
                <svg className="h-4 w-4 text-tan/60" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.16 12.594l-4.995-1.624c-1.314-.428-2.51 1.224-1.51 2.272l3.5 3.674c.667.7 1.804.524 2.179-.336l.929-2.135c.366-.842-.064-1.819-.929-1.852l-.001-.001zm-7.469-2.301l-.001-7.227c0-1.099-1.222-1.633-2.06-.902l-3.516 3.085c-.671.589-.516 1.726.295 2.103l4.422 2.046c.853.395 1.886-.205 1.886-1.105h-.026zM10.756 16.4l-3.514 3.085c-.838.736-.378 2.16.787 2.16h4.6c1.115 0 1.7-1.353.913-2.146l-1.086-1.092c-.408-.412-.408-1.092 0-1.504l.184-.185c.408-.412.408-1.092 0-1.504l-.184-.184c-.408-.412-1.086-.412-1.494 0l-.206.186c-.408.4-.812.812-1.196 1.184h.196zm-3.43-5.108L2.331 9.668c-.86-.28-1.683.51-1.426 1.378l1.379 4.65c.302 1.024 1.694 1.143 2.18.186l2.45-4.802c.408-.804-.34-1.708-1.214-1.708l-.374.12z"/>
                </svg>
                Yelp
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
                {heading}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-block text-sm text-cream/60 hover:text-tan hover:translate-x-1 transition-all duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Hours + Newsletter row */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Hours card */}
          <div className="rounded-lg border border-cream/8 bg-cream/[0.03] p-7">
            <h3 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
              Access &amp; Office Hours
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 text-sm">
              <div className="flex items-start gap-3">
                {/* Gate icon */}
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm bg-tan/10">
                  <svg className="h-4 w-4 text-tan" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-cream">Gate Access</p>
                  <p className="text-cream/50">24 hours / 7 days a week</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                {/* Office icon */}
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm bg-tan/10">
                  <svg className="h-4 w-4 text-tan" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-cream">Office</p>
                  <p className="text-cream/50">By appointment</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-lg border border-cream/8 bg-cream/[0.03] p-7 text-center">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
              Need a Unit?
            </h3>
            <p className="mb-5 text-sm text-cream/50">
              Browse available units or join our waiting list to get notified when a unit opens up.
            </p>
            <div className="flex justify-center gap-3">
              <a href="/units" className="rounded-sm bg-tan px-5 py-2.5 text-sm font-semibold text-brown hover:bg-tan-light transition-colors duration-200">
                View Units
              </a>
              <a href="/waiting-list" className="rounded-sm border border-cream/20 px-5 py-2.5 text-sm font-semibold text-cream hover:border-tan hover:text-tan transition-colors duration-200">
                Join Waiting List
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 border-t border-cream/8 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 text-xs text-cream/35 sm:flex-row">
            <p>&copy; {new Date().getFullYear()} Tuscany Village Self Storage. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <Link href="/privacy" className="hover:text-cream/60 transition-colors duration-200">
                Privacy Policy
              </Link>
              <span className="text-cream/20">&middot;</span>
              <Link href="/terms" className="hover:text-cream/60 transition-colors duration-200">
                Terms of Service
              </Link>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-cream/30 sm:text-right">
            Powered by Storable Easy
          </p>
        </div>
      </div>
    </footer>
  )
}
