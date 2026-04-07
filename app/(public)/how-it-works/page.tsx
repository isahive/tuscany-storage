import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'Learn how easy it is to rent a storage unit at Tuscany Village Self Storage in Florence, SC.',
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
    tip: 'Gate access is available 7 days a week, 6 AM to 10 PM.',
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
    a: 'Gate access is available 7 days a week from 6 AM to 10 PM. If you need extended access, contact our office to discuss options.',
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
      {/* Header */}
      <div className="bg-brown py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl">
            How It Works
          </h1>
          <p className="mt-3 max-w-xl text-cream/60">
            Renting a storage unit should be simple. Here&apos;s exactly what to expect.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="space-y-20">
          {STEPS.map((step, idx) => (
            <div
              key={step.step}
              className={`grid items-center gap-12 lg:grid-cols-2 ${
                idx % 2 === 1 ? 'lg:grid-flow-dense' : ''
              }`}
            >
              {/* Image */}
              <div className={`relative overflow-hidden rounded-2xl ${idx % 2 === 1 ? 'lg:col-start-2' : ''}`}>
                <Image
                  src={step.image}
                  alt={step.title}
                  width={800}
                  height={500}
                  className="h-72 w-full object-cover sm:h-96"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-brown/30 to-transparent" />
              </div>

              {/* Copy */}
              <div className={idx % 2 === 1 ? 'lg:col-start-1' : ''}>
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-tan/30 bg-tan/10 mb-5">
                  <span className="font-serif text-xl font-bold text-tan">{step.step}</span>
                </div>
                <h2 className="font-serif text-3xl font-bold text-brown sm:text-4xl">
                  {step.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted">{step.body}</p>
                <div className="mt-5 rounded-lg border border-tan/20 bg-tan/5 px-5 py-4">
                  <p className="flex items-start gap-2 text-sm text-brown/70">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-tan" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Pro tip:</strong> {step.tip}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="border-t border-mid bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center font-serif text-3xl font-bold text-brown sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-mid p-6">
                <h3 className="font-semibold text-brown">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-brown py-14">
        <div className="mx-auto max-w-xl px-4 text-center">
          <h2 className="font-serif text-3xl font-bold text-cream">
            Ready to get started?
          </h2>
          <p className="mt-3 text-cream/60">Browse available units or join our waiting list.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/units"
              className="w-full rounded bg-tan px-8 py-3 font-semibold text-brown hover:bg-tan-light transition-colors sm:w-auto"
            >
              View Units
            </Link>
            <Link
              href="/contact"
              className="w-full rounded border border-cream/30 px-8 py-3 font-semibold text-cream hover:border-tan hover:text-tan transition-colors sm:w-auto"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
