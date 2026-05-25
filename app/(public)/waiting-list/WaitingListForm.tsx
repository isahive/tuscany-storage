'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

type SizeOption = { value: string; label: string }
type FormState = 'idle' | 'submitting' | 'success' | 'error'

type Props = {
  defaultSize: string
  sizeOptions: SizeOption[]
  turnstileSiteKey: string
}

declare global {
  interface Window {
    __waitingListTurnstile: (token: string) => void
  }
}

export default function WaitingListForm({ defaultSize, sizeOptions, turnstileSiteKey }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [preferredSize, setPreferredSize] = useState(defaultSize)
  const [desiredMoveInDate, setDesiredMoveInDate] = useState('')
  const [notes, setNotes] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    window.__waitingListTurnstile = (token: string) => setTurnstileToken(token)
    return () => {
      delete (window as unknown as { __waitingListTurnstile?: unknown }).__waitingListTurnstile
    }
  }, [])

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const showEmailHint = emailTouched && email.length > 0 && !emailLooksValid

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage('')
    if (!emailLooksValid) {
      setEmailTouched(true)
      return
    }
    setState('submitting')
    try {
      const res = await fetch('/api/public/waiting-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          preferredSize,
          desiredMoveInDate: desiredMoveInDate || undefined,
          notes: notes || undefined,
          smsOptIn,
          turnstileToken,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to submit')
      setState('success')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="rounded border border-gray-200 bg-gray-50 p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-900">You&apos;re on the list!</h2>
        <p className="mt-2 text-sm text-gray-700">
          We&apos;ll contact you as soon as a matching unit becomes available.
        </p>
      </div>
    )
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="wl-name" className="block text-sm font-semibold text-gray-900">
            Name<span className="text-red-600">*</span>
          </label>
          <input
            id="wl-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-olive focus:outline-none focus:ring-1 focus:ring-olive"
          />
        </div>

        <div>
          <label htmlFor="wl-phone" className="block text-sm font-semibold text-gray-900">
            Cell phone<span className="text-red-600">*</span>
          </label>
          <input
            id="wl-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-olive focus:outline-none focus:ring-1 focus:ring-olive"
          />
        </div>

        <div>
          <label htmlFor="wl-email" className="block text-sm font-semibold text-gray-900">
            Email<span className="text-red-600">*</span>
          </label>
          <input
            id="wl-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-olive focus:outline-none focus:ring-1 focus:ring-olive"
          />
          {showEmailHint && (
            <p className="mt-1 text-sm text-gray-600">Please enter a valid email.</p>
          )}
        </div>

        <div>
          <label className="flex items-start gap-3 text-sm text-gray-900">
            <input
              type="checkbox"
              checked={smsOptIn}
              onChange={(e) => setSmsOptIn(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-olive focus:ring-olive"
            />
            <span className="font-semibold">
              I agree to receive text message communications from this facility.
            </span>
          </label>
          <p className="mt-2 text-sm text-gray-600">
            By subscribing, you agree to receive communications via text message at the phone
            number provided. Reply STOP to cancel. Message rates may apply.
          </p>
        </div>

        <div>
          <label htmlFor="wl-size" className="block text-sm font-semibold text-gray-900">
            Desired Unit Type
          </label>
          <select
            id="wl-size"
            value={preferredSize}
            onChange={(e) => setPreferredSize(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:border-olive focus:outline-none focus:ring-1 focus:ring-olive"
          >
            {sizeOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="wl-move-in" className="block text-sm font-semibold text-gray-900">
            Desired Move-in Date
          </label>
          <input
            id="wl-move-in"
            type="date"
            value={desiredMoveInDate}
            onChange={(e) => setDesiredMoveInDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-olive focus:outline-none focus:ring-1 focus:ring-olive"
          />
        </div>

        <div>
          <label htmlFor="wl-notes" className="block text-sm font-semibold text-gray-900">
            Notes
          </label>
          <textarea
            id="wl-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-olive focus:outline-none focus:ring-1 focus:ring-olive"
          />
        </div>

        <div
          className="cf-turnstile"
          data-sitekey={turnstileSiteKey || '1x00000000000000000000AA'}
          data-callback="__waitingListTurnstile"
        />

        {errorMessage && (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={state === 'submitting'}
            className="rounded bg-olive px-6 py-2.5 text-base font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-olive-dark disabled:opacity-60"
          >
            {state === 'submitting' ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </form>
    </>
  )
}
