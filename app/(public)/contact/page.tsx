'use client'

import { useState } from 'react'

const CONTACT_ITEMS = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
    label: 'Phone',
    value: '(865) 426-2100',
    href: 'tel:+18654262100',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    label: 'Email',
    value: 'Tuscanystorage@gmail.com',
    href: 'mailto:Tuscanystorage@gmail.com',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    label: 'Address',
    value: '2519 Highway 116, Caryville, TN 37714',
    href: 'https://www.google.com/maps/search/?api=1&query=2519+Highway+116+Caryville+TN+37714',
  },
]

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [state, setState] = useState<FormState>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('submitting')
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to send')
      setState('success')
    } catch {
      setState('error')
    }
  }

  return (
    <>
      {/* Hero header */}
      <div className="relative overflow-hidden bg-brown py-16 sm:py-24">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-tan" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-tan" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-tan">
              Get in Touch
            </p>
            <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl lg:text-6xl">
              Contact Us
            </h1>
            <p className="mt-4 text-lg text-cream/50">
              We&apos;re here to help. Reach out anytime and our team will respond promptly.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-cream">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-5 lg:gap-16">

            {/* Contact info column */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="font-serif text-2xl font-bold text-brown">Reach Out Directly</h2>
                <p className="mt-3 leading-relaxed text-muted">
                  Have a question about a unit, billing, or gate access? Our team typically
                  responds within a few hours during business hours.
                </p>
              </div>

              {/* Contact cards */}
              <div className="space-y-3">
                {CONTACT_ITEMS.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target={item.label === 'Address' ? '_blank' : undefined}
                    rel={item.label === 'Address' ? 'noopener noreferrer' : undefined}
                    className="group flex items-center gap-4 rounded-xl border border-mid/60 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-tan/30 hover:shadow-md hover:shadow-brown/[0.04]"
                  >
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-tan/10 text-tan transition-colors group-hover:bg-tan/20">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                        {item.label}
                      </p>
                      <p className="mt-0.5 font-medium text-brown">{item.value}</p>
                    </div>
                  </a>
                ))}
              </div>

              {/* Map embed */}
              <div className="overflow-hidden rounded-2xl border border-mid/60 shadow-md shadow-brown/[0.04]">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3229.5!2d-84.223!3d36.297!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2s2519+Highway+116+Caryville+TN+37714!5e0!3m2!1sen!2sus!4v1"
                  width="100%"
                  height="260"
                  style={{ border: 0, display: 'block' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Tuscany Village Self Storage Location"
                />
              </div>

              {/* Hours card */}
              <div className="overflow-hidden rounded-2xl bg-brown p-7 shadow-lg shadow-brown/10">
                <h3 className="mb-5 font-serif text-lg font-semibold text-cream">Office Hours</h3>
                <div className="space-y-3 text-sm">
                  {[
                    ['Monday \u2013 Friday', '9:00 AM \u2013 5:00 PM'],
                    ['Saturday', '9:00 AM \u2013 2:00 PM'],
                    ['Sunday', 'Closed'],
                  ].map(([day, hours]) => (
                    <div key={day} className="flex items-center justify-between">
                      <span className="text-cream/60">{day}</span>
                      <span className="rounded-full bg-cream/5 px-3 py-0.5 font-medium text-cream">{hours}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t border-cream/10 pt-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-olive">
                      <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-olive opacity-75" />
                    </span>
                    <p className="text-xs text-cream/50">
                      Gate access available 24/7
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact form column */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-mid/60 bg-white p-8 shadow-md shadow-brown/[0.04] sm:p-10">
                <h2 className="mb-2 font-serif text-2xl font-bold text-brown">Send a Message</h2>
                <p className="mb-8 text-sm text-muted">Fill out the form below and we&apos;ll get back to you within one business day.</p>

                {state === 'success' ? (
                  <div className="rounded-2xl bg-olive/5 p-10 text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-olive/10">
                      <svg className="h-8 w-8 text-olive" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <h3 className="font-serif text-2xl font-bold text-brown">Message Sent!</h3>
                    <p className="mx-auto mt-3 max-w-sm text-muted">
                      Thank you for reaching out. We&apos;ll get back to you within one business day.
                    </p>
                    <button
                      onClick={() => { setState('idle'); setForm({ name: '', email: '', phone: '', subject: '', message: '' }) }}
                      className="mt-6 text-sm font-semibold text-tan transition-colors hover:text-brown hover:underline"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                      {/* Name */}
                      <div className="group relative">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                          Full Name <span className="text-tan">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Jane Smith"
                          className="w-full rounded-xl border border-mid/80 bg-cream/30 px-4 py-3 text-sm text-brown placeholder-muted/50 transition-all focus:border-tan focus:bg-white focus:outline-none focus:ring-2 focus:ring-tan/10"
                        />
                      </div>
                      {/* Phone */}
                      <div className="group relative">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="(865) 426-0000"
                          className="w-full rounded-xl border border-mid/80 bg-cream/30 px-4 py-3 text-sm text-brown placeholder-muted/50 transition-all focus:border-tan focus:bg-white focus:outline-none focus:ring-2 focus:ring-tan/10"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                        Email <span className="text-tan">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="jane@example.com"
                        className="w-full rounded-xl border border-mid/80 bg-cream/30 px-4 py-3 text-sm text-brown placeholder-muted/50 transition-all focus:border-tan focus:bg-white focus:outline-none focus:ring-2 focus:ring-tan/10"
                      />
                    </div>

                    {/* Subject */}
                    <div className="relative">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                        Subject
                      </label>
                      <select
                        value={form.subject}
                        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                        className="w-full appearance-none rounded-xl border border-mid/80 bg-cream/30 px-4 py-3 text-sm text-brown transition-all focus:border-tan focus:bg-white focus:outline-none focus:ring-2 focus:ring-tan/10"
                      >
                        <option value="">Select a subject...</option>
                        <option value="unit_inquiry">Unit Inquiry</option>
                        <option value="billing">Billing Question</option>
                        <option value="gate_access">Gate Access</option>
                        <option value="reservation">Reservation</option>
                        <option value="other">Other</option>
                      </select>
                      <svg className="pointer-events-none absolute right-4 top-[42px] h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                        Message <span className="text-tan">*</span>
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={form.message}
                        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                        placeholder="Tell us how we can help..."
                        className="w-full resize-none rounded-xl border border-mid/80 bg-cream/30 px-4 py-3 text-sm text-brown placeholder-muted/50 transition-all focus:border-tan focus:bg-white focus:outline-none focus:ring-2 focus:ring-tan/10"
                      />
                    </div>

                    {state === 'error' && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        Something went wrong. Please try again or call us directly.
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={state === 'submitting'}
                      className="w-full rounded-xl bg-brown py-3.5 font-semibold text-cream shadow-md shadow-brown/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brown-light hover:shadow-lg disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
                    >
                      {state === 'submitting' ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Sending...
                        </span>
                      ) : 'Send Message'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
