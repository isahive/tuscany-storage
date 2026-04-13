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
    <header className="sticky top-0 z-50 bg-brown shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex flex-col leading-tight">
            <span className="font-serif text-lg font-bold text-tan">
              Tuscany Village
            </span>
            <span className="text-xs font-medium tracking-widest text-cream/70 uppercase">
              Self Storage
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-cream/80 hover:text-tan transition-colors duration-150"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="tel:+18654262100"
              className="text-sm font-medium text-cream/80 hover:text-tan transition-colors"
            >
              (865) 426-2100
            </a>
            <Link
              href="/waiting-list"
              className="rounded bg-tan px-4 py-2 text-sm font-semibold text-brown hover:bg-tan-light transition-colors"
            >
              Join Waiting List
            </Link>
            <Link
              href="/portal"
              className="rounded border border-cream/30 px-4 py-2 text-sm font-semibold text-cream hover:border-tan hover:text-tan transition-colors"
            >
              Tenant Login
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden rounded p-2 text-cream/80 hover:text-tan focus:outline-none"
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
      {mobileOpen && (
        <div className="md:hidden border-t border-cream/10 bg-brown-light">
          <nav className="flex flex-col px-4 py-4 gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded px-3 py-2 text-sm font-medium text-cream/80 hover:bg-cream/5 hover:text-tan transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-cream/10 pt-3">
              <a
                href="tel:+18654262100"
                className="px-3 py-2 text-sm font-medium text-cream/70"
              >
                (865) 426-2100
              </a>
              <Link
                href="/waiting-list"
                className="rounded bg-tan px-4 py-2 text-center text-sm font-semibold text-brown"
                onClick={() => setMobileOpen(false)}
              >
                Join Waiting List
              </Link>
              <Link
                href="/portal"
                className="rounded border border-cream/30 px-4 py-2 text-center text-sm font-semibold text-cream"
                onClick={() => setMobileOpen(false)}
              >
                Tenant Login
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
