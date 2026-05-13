'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Rent Storage', href: '/units' },
  { label: 'Tenant Protection', href: '/tenant-protection' },
  { label: 'Map', href: '/map' },
  { label: 'Contact Us', href: '/contact' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
        <div className="flex h-40 items-stretch justify-between sm:h-48">

          {/* Logo */}
          <Link
            href="/"
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

          {/* Right side — stacked: top (phone + button), bottom (nav links) */}
          <div className="hidden flex-col items-end justify-between py-5 lg:flex">
            {/* Top row — phone + Make a Payment */}
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
              <Link
                href="/portal"
                className="rounded bg-olive px-6 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-olive-dark transition-colors duration-200"
              >
                Make a Payment / Login
              </Link>
            </div>

            {/* Bottom row — nav links */}
            <nav className="flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-base font-medium text-gray-700 hover:text-olive transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
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
          mobileOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-gray-100">
          <nav className="flex flex-col px-4 py-4 gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded px-3 py-2.5 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-olive transition-colors duration-200"
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
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                (865) 426-2100
              </a>
              <Link
                href="/portal"
                className="block rounded bg-olive px-4 py-2.5 text-center text-base font-semibold text-white hover:bg-olive-dark transition-colors duration-200"
                onClick={() => setMobileOpen(false)}
              >
                Make a Payment / Login
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
