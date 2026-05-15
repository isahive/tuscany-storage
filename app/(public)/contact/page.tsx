'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    __contactTurnstile: (token: string) => void
  }
}

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [state, setState] = useState<FormState>('idle')
  const [turnstileToken, setTurnstileToken] = useState('')

  useEffect(() => {
    window.__contactTurnstile = (token: string) => setTurnstileToken(token)
    return () => {
      delete (window as any).__contactTurnstile
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('submitting')
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, turnstileToken }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to send')
      setState('success')
    } catch {
      setState('error')
    }
  }

  const inputCls =
    'w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none'
  const labelCls = 'block mb-1.5 text-sm font-semibold text-gray-900'

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
      />

      <div className="min-h-screen bg-gray-200 py-10 px-4">
        <h1 className="text-center text-3xl font-normal text-gray-500 mb-10">Contact Us</h1>

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">

          {/* Left — form */}
          <div>
            {state === 'success' ? (
              <div className="py-8 text-center">
                <p className="text-olive font-semibold text-base mb-3">Your message has been sent!</p>
                <p className="text-sm text-gray-500 mb-4">We will be in touch shortly.</p>
                <button
                  onClick={() => {
                    setState('idle')
                    setForm({ name: '', email: '', phone: '', message: '' })
                    setTurnstileToken('')
                  }}
                  className="text-sm text-tan underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelCls}>Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Enter your name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="Enter your email address"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone Number (optional)"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Message</label>
                  <textarea
                    required
                    rows={7}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder="How can we help you?"
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <div
                  className="cf-turnstile"
                  data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'}
                  data-callback="__contactTurnstile"
                />

                {state === 'error' && (
                  <p className="text-sm text-red-600">
                    Something went wrong. Please complete the CAPTCHA and try again, or call us
                    directly.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={state === 'submitting'}
                  className="bg-olive px-5 py-2.5 text-sm font-semibold text-white hover:bg-olive-dark disabled:opacity-60"
                >
                  {state === 'submitting' ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>

          {/* Right — contact info */}
          <div className="space-y-4 text-gray-900">
            <p className="text-olive text-lg leading-snug">We would love to hear from you!</p>
            <div>
              <p className="font-bold text-lg">Tuscany Village Self Storage:</p>
              <p className="mt-1 text-lg">2519 Highway 116</p>
              <p className="text-lg">Caryville, TN. 37714</p>
            </div>
            <div>
              <p className="font-bold text-lg">Email:</p>
              <p className="text-lg">tuscanystorage@gmail.com</p>
            </div>
            <p className="text-lg">
              <span className="font-bold">Phone:</span> (865) 426-2100
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
