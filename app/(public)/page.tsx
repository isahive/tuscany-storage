import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Tuscany Village Self Storage | Caryville, TN',
  description:
    'Storage Units, Boat, Camper, RV & Trailer Storage Located in RockyTop/Caryville, TN 37714. State-of-the-art facility with the best customer service around.',
}

const CONVENIENCE_ITEMS = [
  'ADA Compliant Units Available',
  'Great Customer Service',
  'Onsite Security',
  'Digital Video Surveillance',
  'Online Bill Pay',
  'Variety of Unit Sizes Available',
  'Drive-up Access',
  'Fenced & Gated',
]

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5 flex-shrink-0 text-olive"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg
      className="h-16 w-16 text-olive"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  )
}

function SmileIcon() {
  return (
    <svg
      className="h-16 w-16 text-olive"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
      />
    </svg>
  )
}

function ThumbsUpIcon() {
  return (
    <svg
      className="h-16 w-16 text-olive"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z"
      />
    </svg>
  )
}

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative bg-brown">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero/storage-aisle.png"
            alt="Tuscany Village Self Storage facility"
            fill
            priority
            className="object-cover"
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="max-w-xl bg-gradient-to-br from-black/70 via-black/55 to-black/35 p-8 text-white sm:p-10">
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              Tuscany Village Self Storage
            </h1>
            <p className="mt-5 text-lg leading-relaxed sm:text-xl">
              Storage Units, Boat, Camper, RV &amp; Trailer Storage Located in
              RockyTop/Caryville, TN 37714
            </p>
            <p className="mt-5 text-sm leading-relaxed text-white/90 sm:text-base">
              We have a state-of-the-art facility with the best customer service
              around! When you rent from us, your belongings will be secure!
              Give us a call or book online today!
            </p>
            <Link
              href="/units"
              className="mt-7 inline-block rounded bg-olive px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-olive/90"
            >
              Rent Online
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why Use Tuscany Village Self Storage? ───────────────────────── */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-normal text-gray-800 sm:text-3xl">
            Why Use Tuscany Village Self Storage?
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-14">
            <div>
              <h3 className="text-lg font-semibold text-olive">Customer Service</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-700 sm:text-base">
                We are dedicated to customer service. We are committed to
                offering you exceptional value for your hard-earned money.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-olive">Book and Pay Online</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-700 sm:text-base">
                Our online software is easy to use and has all the features for
                a rich, interactive experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── All the Convenience and Security You Need ─────────────────── */}
      <section className="bg-gray-100 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-normal text-gray-800 sm:text-3xl">
            All the Convenience and Security You Need
          </h2>
          <ul className="mt-12 grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONVENIENCE_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-gray-700 sm:text-base">
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Our Promise to You ──────────────────────────────────────────── */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-normal text-gray-800 sm:text-3xl">
            Our Promise to You
          </h2>
          <div className="mt-14 grid grid-cols-1 gap-12 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <LockIcon />
              <h3 className="mt-5 text-lg font-semibold text-olive">Security</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">
                We take the security of your property seriously, and our SSL
                secure website protects your personal information.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <SmileIcon />
              <h3 className="mt-5 text-lg font-semibold text-olive">Customer Service</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">
                We commit to providing you a clean, ready-to-rent unit and
                friendly, helpful employees.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <ThumbsUpIcon />
              <h3 className="mt-5 text-lg font-semibold text-olive">Convenience</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">
                Access your online account from the convenience of your own
                home, 24 hours a day and 7 days a week.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
