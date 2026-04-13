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
      {/* Header */}
      <div className="bg-brown py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-serif text-4xl font-bold text-cream sm:text-5xl">Contact Us</h1>
          <p className="mt-3 text-cream/60">We&apos;re here to help. Reach out anytime.</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-5">
          {/* Contact info */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="font-serif text-2xl font-bold text-brown">Get in Touch</h2>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Have a question about a unit, billing, or gate access? Our team typically
                responds within a few hours during business hours.
              </p>
            </div>

            <div className="space-y-4">
              {CONTACT_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.label === 'Address' ? '_blank' : undefined}
                  rel={item.label === 'Address' ? 'noopener noreferrer' : undefined}
                  className="flex items-start gap-4 rounded-xl border border-mid p-4 hover:border-tan transition-colors"
                >
                  <div className="mt-0.5 flex-shrink-0 text-tan">{item.icon}</div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-brown">{item.value}</p>
                  </div>
                </a>
              ))}
            </div>

            {/* Map embed */}
            <div className="overflow-hidden rounded-xl border border-mid">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3229.5!2d-84.223!3d36.297!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2s2519+Highway+116+Caryville+TN+37714!5e0!3m2!1sen!2sus!4v1"
                width="100%"
                height="300"
                style={{ border: 0, borderRadius: '0.75rem' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Tuscany Village Self Storage Location"
              />
            </div>

            {/* Hours */}
            <div className="rounded-xl bg-brown p-6 text-cream">
              <h3 className="mb-4 font-serif text-lg font-semibold">Office Hours</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['Monday – Friday', '9:00 AM – 5:00 PM'],
                  ['Saturday', '9:00 AM – 2:00 PM'],
                  ['Sunday', 'Closed'],
                ].map(([day, hours]) => (
                  <div key={day} className="flex justify-between">
                    <span className="text-cream/70">{day}</span>
                    <span className="font-medium">{hours}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-cream/10 pt-4">
                <p className="text-xs text-cream/60">
                  Gate access available 7 days a week, 6 AM – 10 PM.
                </p>
              </div>
            </div>
          </div>

          {/* Contact form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-mid bg-white p-8">
              <h2 className="mb-6 font-serif text-2xl font-bold text-brown">Send a Message</h2>

              {state === 'success' ? (
                <div className="rounded-xl bg-olive/10 p-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-olive/20">
                    <svg className="h-7 w-7 text-olive" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-brown">Message Sent!</h3>
                  <p className="mt-2 text-sm text-muted">
                    We&apos;ll get back to you within one business day.
                  </p>
                  <button
                    onClick={() => { setState('idle'); setForm({ name: '', email: '', phone: '', subject: '', message: '' }) }}
                    className="mt-5 text-sm font-semibold text-tan hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-brown">
                        Full Name <span className="text-tan">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Jane Smith"
                        className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown placeholder-muted focus:border-tan focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-brown">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="(865) 426-0000"
                        className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown placeholder-muted focus:border-tan focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-brown">
                      Email <span className="text-tan">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="jane@example.com"
                      className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown placeholder-muted focus:border-tan focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-brown">
                      Subject
                    </label>
                    <select
                      value={form.subject}
                      onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                      className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown focus:border-tan focus:outline-none"
                    >
                      <option value="">Select a subject…</option>
                      <option value="unit_inquiry">Unit Inquiry</option>
                      <option value="billing">Billing Question</option>
                      <option value="gate_access">Gate Access</option>
                      <option value="reservation">Reservation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-brown">
                      Message <span className="text-tan">*</span>
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      placeholder="Tell us how we can help…"
                      className="w-full rounded-lg border border-mid px-4 py-2.5 text-sm text-brown placeholder-muted focus:border-tan focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={state === 'submitting'}
                    className="w-full rounded-lg bg-tan py-3 font-semibold text-brown transition-colors hover:bg-tan-light disabled:opacity-60"
                  >
                    {state === 'submitting' ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
