import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'Learn how easy it is to rent a storage unit at Tuscany Village Self Storage in Caryville, TN.',
}

const STEPS = [
  {
    step: '01',
    title: 'Browse & Choose Your Unit',
    body: 'Visit our units page to see everything available. Filter by size, type, and price to find the right fit. Each listing includes photos, dimensions, features, and monthly pricing.',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80',
    tip: 'Not sure what size you need? Check our Size Guide for helpful comparisons.',
  },
  {
    step: '02',
    title: 'Join the Waiting List',
    body: "Spot the unit you want but it\'s currently occupied? Join our waiting list with your contact info and preferred unit type. When a matching unit opens up, you\'re first in line — we\'ll reach out immediately.",
    image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&q=80',
    tip: 'Most waiting list members get a unit within 2–4 weeks.',
  },
  {
    step: '03',
    title: 'Complete Your Move-In',
    body: "Once a unit is ready for you, our team will contact you to complete the move-in process. You'll review your lease, sign digitally, pay your first month plus deposit, and get your personalized gate code — all without leaving the house.",
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    tip: 'Bring a valid photo ID and payment method. That\'s all you need.',
  },
  {
    step: '04',
    title: 'Move In & Manage Online',
    body: 'Get your gate code and head to your unit at your convenience. Use our tenant portal to pay rent, update your gate code, view your access history, or give move-out notice — all from your phone.',
    image: 'https://images.unsplash.com/photo-1565183997392-2f6f122e5912?w=800&q=80',
    tip: 'Gate access is available 24 hours a day, 7 days a week.',
  },
]

const FAQS = [
  {
    q: 'How long are your leases?',
    a: 'All leases are month-to-month. There are no long-term commitments. Simply give 30 days notice when you\'re ready to move out.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards and debit cards through our secure online portal. We also offer autopay so you never have to worry about missing a payment.',
  },
  {
    q: 'Is there a deposit?',
    a: 'Yes, we require a one-time refundable security deposit equal to one month\'s rent. It\'s returned when you move out, provided the unit is left in good condition.',
  },
  {
    q: 'Can I access my unit 24/7?',
    a: 'Gate access is available 24 hours a day, 7 days a week.',
  },
  {
    q: 'What happens if I miss a payment?',
    a: 'You have a 5-day grace period after your due date. After that, a late fee is applied and your account moves to delinquent status. At 10 days, gate access may be suspended. We send reminders well in advance to help you stay current.',
  },
  {
    q: 'Can I move out early?',
    a: 'Yes. Simply give 30 days notice through the tenant portal. Your deposit will be returned after a unit inspection.',
  },
]

export default function HowItWorksPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map(faq => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a }
          }))
        }) }}
      />

      {/* Hero header */}
      <div className="relative overflow-hidden bg-brown py-16 sm:py-24">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-tan" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-tan" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
              Simple Process
            </p>
            <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl lg:text-6xl">
              How It Works
            </h1>
            <p className="mt-4 text-lg text-cream/50">
              Renting a storage unit should be simple. Here&apos;s exactly what to expect, from first visit to move-in day.
            </p>
          </div>
        </div>
      </div>

      {/* Steps — single responsive layout (no duplicate rendering) */}
      <div className="bg-cream">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="space-y-16 lg:space-y-20">
            {STEPS.map((step, idx) => (
              <div key={step.step} className="relative">
                {/* Connector line (desktop) */}
                {idx < STEPS.length - 1 && (
                  <div className="absolute left-1/2 top-full z-0 hidden h-16 w-px -translate-x-1/2 bg-gradient-to-b from-tan/40 to-transparent lg:block" />
                )}

                <div
                  className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-16 ${
                    idx % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
                  }`}
                >
                  {/* Image */}
                  <div className="relative overflow-hidden rounded-2xl shadow-xl shadow-brown/[0.06]">
                    <Image
                      src={step.image}
                      alt={step.title}
                      width={800}
                      height={500}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="h-48 w-full object-cover sm:h-80 lg:h-96"
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-brown/30 to-transparent" />
                    <div className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-tan/90 shadow-lg backdrop-blur-sm lg:bottom-5 lg:right-5 lg:h-14 lg:w-14">
                      <span className="font-serif text-base font-bold text-brown lg:text-lg">{step.step}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div>
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-tan/20 bg-tan/5 px-4 py-1.5">
                      <span className="font-serif text-sm font-bold text-tan">Step {step.step}</span>
                    </div>
                    <h2 className="font-serif text-2xl font-bold text-brown sm:text-3xl lg:text-4xl">
                      {step.title}
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base lg:mt-5">{step.body}</p>
                    <div className="mt-5 rounded-xl border border-tan/15 bg-white px-5 py-4 shadow-sm lg:mt-6 lg:px-6 lg:py-5">
                      <p className="flex items-start gap-2 text-xs text-brown/70 sm:text-sm lg:gap-3">
                        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-tan/10">
                          <svg className="h-3 w-3 text-tan" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                          </svg>
                        </span>
                        <span><strong className="text-brown">Pro tip:</strong> {step.tip}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ section */}
      <div className="border-t border-mid bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
              Common Questions
            </p>
            <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted">
              Everything you need to know about renting a storage unit with us.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-mid/60 bg-cream/50 transition-all hover:border-tan/30 hover:shadow-sm [&[open]]:border-tan/30 [&[open]]:bg-white [&[open]]:shadow-md [&[open]]:shadow-brown/[0.04]"
                {...(idx === 0 ? { open: true } : {})}
              >
                <summary className="flex cursor-pointer items-center justify-between px-6 py-5 text-left [&::-webkit-details-marker]:hidden">
                  <h3 className="pr-4 font-semibold text-brown transition-colors group-open:text-brown">
                    {faq.q}
                  </h3>
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-mid/50 text-muted transition-all group-open:rotate-45 group-open:bg-tan/10 group-open:text-tan">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </span>
                </summary>
                <div className="px-6 pb-6 pt-0">
                  <p className="leading-relaxed text-muted">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="relative overflow-hidden bg-brown py-16 sm:py-20">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tan" />
        </div>
        <div className="relative mx-auto max-w-xl px-4 text-center">
          <h2 className="font-serif text-3xl font-bold text-cream sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mt-4 text-cream/50">Browse available units or join our waiting list.</p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/units"
              className="w-full rounded-full bg-tan px-10 py-3.5 font-semibold text-brown shadow-md shadow-tan/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-tan-light hover:shadow-lg sm:w-auto"
            >
              View Units
            </Link>
            <Link
              href="/contact"
              className="w-full rounded-full border border-cream/20 px-10 py-3.5 font-semibold text-cream transition-all duration-200 hover:-translate-y-0.5 hover:border-tan hover:text-tan sm:w-auto"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
