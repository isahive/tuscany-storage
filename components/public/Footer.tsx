import Link from 'next/link'

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
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="space-y-4">
            <div>
              <p className="font-serif text-xl font-bold text-tan">Tuscany Village</p>
              <p className="text-xs tracking-widest text-cream/60 uppercase">Self Storage</p>
            </div>
            <p className="text-sm leading-relaxed text-cream/70">
              Caryville&apos;s premier self storage facility. Clean, secure, and
              conveniently located with 24/7 gate access.
            </p>
            <div className="space-y-1 text-sm text-cream/70">
              <p>2519 Highway 116</p>
              <p>Caryville, TN 37714</p>
              <a href="tel:+18654262100" className="block hover:text-tan transition-colors">
                (865) 426-2100
              </a>
              <a href="mailto:Tuscanystorage@gmail.com" className="block hover:text-tan transition-colors">
                Tuscanystorage@gmail.com
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-tan">
                {heading}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-cream/70 hover:text-tan transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Hours */}
        <div className="mt-10 rounded-lg border border-cream/10 bg-brown-light p-6">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-tan">
            Access & Office Hours
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm text-cream/70">
            <div>
              <p className="font-medium text-cream">Gate Access</p>
              <p>7 days a week, 6am – 10pm</p>
            </div>
            <div>
              <p className="font-medium text-cream">Office Hours</p>
              <p>Mon–Fri: 9am – 5pm</p>
              <p>Sat: 9am – 2pm</p>
              <p>Sun: Closed</p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-cream/10 pt-8 text-xs text-cream/40 sm:flex-row">
          <p>© {new Date().getFullYear()} Tuscany Village Self Storage. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-cream/70 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-cream/70 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
