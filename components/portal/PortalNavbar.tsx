'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const PORTAL_NAV = [
  { label: 'Dashboard',        href: '/portal' },
  { label: 'Recurring Billing', href: '/portal/billing' },
  { label: 'Payment History',  href: '/portal/receipts' },
  { label: 'Notifications',    href: '/portal/notifications' },
  // Rent Storage uses the same public listing — the reserve page detects the
  // logged-in session and pre-fills info / offers the saved card on file.
  { label: 'Rent Storage',     href: '/units' },
  { label: 'Edit Profile',     href: '/portal/profile' },
]

interface PortalNavbarProps {
  tenantName: string
}

export default function PortalNavbar({ tenantName }: PortalNavbarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
        <div className="flex h-40 items-stretch justify-between sm:h-48">

          {/* Logo */}
          <Link
            href="/portal"
            aria-label="Tuscany Village Self Storage"
            className="flex flex-shrink-0 items-center pl-2 sm:pl-6 lg:pl-10"
          >
            <Image
              src="/images/brand/logo.png"
              alt="Tuscany Village Self Storage"
              width={620}
              height={186}
              priority
              className="h-28 w-auto object-contain sm:h-32 lg:h-36"
            />
          </Link>

          {/* Right side — top: phone + name + Make a Payment + Log out; bottom: sub-nav */}
          <div className="hidden flex-col items-end justify-between py-5 lg:flex">
            <div className="flex items-center gap-5">
              <a
                href="tel:+18654262100"
                className="flex items-center gap-1.5 text-base text-[#3E5DAA] underline hover:no-underline"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                (865) 426-2100
              </a>
              <span className="text-base text-gray-800">{tenantName}</span>
              <Link
                href="/portal/payments"
                className="rounded bg-olive px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-olive-dark transition-colors"
              >
                Make a Payment
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="rounded bg-olive px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-olive-dark transition-colors"
              >
                Log out
              </button>
            </div>

            <nav className="flex items-center gap-8">
              {PORTAL_NAV.map((link) => {
                const active = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-base font-medium transition-colors duration-200 ${
                      active ? 'text-olive-darker' : 'text-gray-700 hover:text-olive'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden self-center rounded p-2 text-gray-600 hover:text-gray-900 focus:outline-none transition-colors"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-gray-100">
          <nav className="flex flex-col px-4 py-4 gap-1">
            {PORTAL_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded px-3 py-2.5 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-olive transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
              <a
                href="tel:+18654262100"
                className="flex items-center gap-2 px-3 py-2 text-base text-[#3E5DAA] underline"
              >
                (865) 426-2100
              </a>
              <p className="px-3 py-1 text-sm text-gray-600">{tenantName}</p>
              <Link
                href="/portal/payments"
                className="block rounded bg-olive px-4 py-2.5 text-center text-base font-semibold text-white hover:bg-olive-dark transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Make a Payment
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="block w-full rounded bg-olive px-4 py-2.5 text-center text-base font-semibold text-white hover:bg-olive-dark transition-colors"
              >
                Log out
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
