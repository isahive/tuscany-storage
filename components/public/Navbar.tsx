'use client'

import { useState } from 'react'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Units & Pricing', href: '/units' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Size Guide', href: '/size-guide' },
  { label: 'Contact', href: '/contact' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50">
      {/* Thin gold accent line at top */}
      <div className="h-[1px] bg-tan" />

      <div className="bg-brown/95 backdrop-blur-md shadow-lg shadow-black/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex flex-col leading-tight">
                <span className="font-serif text-xl font-bold text-tan tracking-wide">
                  Tuscany Village
                </span>
              </div>
              {/* Decorative vertical gold divider */}
              <div className="hidden sm:block h-8 w-[1px] bg-tan/50" />
              <span className="hidden sm:block text-[11px] font-medium tracking-[0.25em] text-cream/60 uppercase">
                Self Storage
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative py-1 text-sm font-medium text-cream/75 hover:text-tan transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 after:bg-tan after:transition-all after:duration-300 hover:after:w-full"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="hidden lg:flex items-center gap-5">
              <a
                href="tel:+18654262100"
                className="flex items-center gap-2 text-sm font-medium text-cream/75 hover:text-tan transition-colors duration-200"
              >
                {/* Phone icon */}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                (865) 426-2100
              </a>

              <div className="h-5 w-[1px] bg-cream/15" />

              <Link
                href="/waiting-list"
                className="rounded-sm bg-tan px-5 py-2.5 text-sm font-semibold text-brown hover:bg-tan-light transition-all duration-200 hover:shadow-md hover:shadow-tan/20"
              >
                Join Waiting List
              </Link>
              <Link
                href="/portal"
                className="rounded-sm border border-cream/25 px-5 py-2.5 text-sm font-semibold text-cream/90 hover:border-tan hover:text-tan transition-all duration-200"
              >
                Tenant Login
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              type="button"
              className="lg:hidden rounded-sm p-2 text-cream/80 hover:text-tan focus:outline-none transition-colors"
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

        {/* Mobile menu — smooth slide-down */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="border-t border-cream/10 bg-brown-light/50 backdrop-blur-md">
            <nav className="flex flex-col px-4 py-5 gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-sm px-3 py-2.5 text-sm font-medium text-cream/80 hover:bg-cream/5 hover:text-tan transition-colors duration-200"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-3 border-t border-cream/10 pt-4">
                <a
                  href="tel:+18654262100"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-cream/70"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  (865) 426-2100
                </a>
                <Link
                  href="/waiting-list"
                  className="rounded-sm bg-tan px-4 py-2.5 text-center text-sm font-semibold text-brown hover:bg-tan-light transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Join Waiting List
                </Link>
                <Link
                  href="/portal"
                  className="rounded-sm border border-cream/25 px-4 py-2.5 text-center text-sm font-semibold text-cream/90 hover:border-tan hover:text-tan transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Tenant Login
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}
