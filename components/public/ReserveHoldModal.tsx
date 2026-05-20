'use client'

import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { RESERVATION_DEPOSIT_COPY } from '@/lib/reservationFee'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

interface Props {
  open: boolean
  onClose: () => void
  unitId: string
  unitLabel: string
  reservationFeeCents: number
}

/**
 * Reserve Now modal — captures contact + card, charges the per-unit-type
 * reservation fee, and holds the unit. Matches Storable Easy's pop-up that
 * surfaces the "credited back on first rental invoice" promise verbatim.
 */
export default function ReserveHoldModal({
  open, onClose, unitId, unitLabel, reservationFeeCents,
}: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-lg font-semibold text-olive">{unitLabel}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="mb-3">
            <div className="text-sm font-semibold text-gray-700">Reservation Deposit</div>
            <div className="mt-1 text-3xl font-bold text-olive">{formatMoney(reservationFeeCents)}</div>
          </div>
          <p className="mb-4 rounded bg-yellow-50 px-3 py-2 text-xs text-gray-700">
            {RESERVATION_DEPOSIT_COPY}
          </p>

          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <InnerForm
                unitId={unitId}
                reservationFeeCents={reservationFeeCents}
                onClose={onClose}
              />
            </Elements>
          ) : (
            <p className="text-sm text-red-600">Online payments are not configured.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function InnerForm({
  unitId, reservationFeeCents, onClose,
}: {
  unitId: string
  reservationFeeCents: number
  onClose: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', moveInDate: '' })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Pre-fetch clientSecret so we render Elements with the right intent.
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [devMode, setDevMode] = useState(false)

  useEffect(() => {
    fetch('/api/public/reserve-hold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId,
        firstName: 'placeholder',
        lastName: 'placeholder',
        email: 'placeholder@example.com',
        phone: '0000000000',
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) { setError(j.error ?? 'Could not start reservation'); return }
        setClientSecret(j.data.clientSecret)
        setDevMode(!!j.data.devMode)
      })
      .catch(() => setError('Could not start reservation'))
  }, [unitId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.firstName || !form.lastName || !form.email || !form.phone) {
      setError('Please fill in all fields.')
      return
    }

    setSubmitting(true)
    try {
      let confirmedIntentId: string | undefined
      if (!devMode) {
        if (!stripe || !elements || !clientSecret) throw new Error('Card form not ready yet.')
        const card = elements.getElement(CardElement)
        if (!card) throw new Error('Card field missing.')
        const { paymentIntent, error: stripeErr } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card,
            billing_details: {
              name: `${form.firstName} ${form.lastName}`,
              email: form.email,
              phone: form.phone,
            },
          },
        })
        if (stripeErr) throw new Error(stripeErr.message ?? 'Card declined')
        if (paymentIntent?.status !== 'succeeded') throw new Error('Payment did not complete.')
        confirmedIntentId = paymentIntent.id
      }

      const res = await fetch('/api/public/reserve-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          desiredMoveInDate: form.moveInDate || undefined,
          confirmedIntentId,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Reservation failed')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reservation failed')
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-3 py-4 text-center">
        <p className="text-base font-semibold text-olive">Reservation confirmed.</p>
        <p className="text-sm text-gray-600">
          We&apos;ve emailed you the next steps. You can finalize your rental from the same email link
          or call us to schedule move-in.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-olive px-5 py-2 text-sm font-semibold text-white hover:bg-olive-dark"
        >
          Done
        </button>
      </div>
    )
  }

  const input = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-olive focus:outline-none'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input className={input} placeholder="First name" value={form.firstName}
          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
        <input className={input} placeholder="Last name" value={form.lastName}
          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
      </div>
      <input className={input} placeholder="Email" type="email" value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
      <input className={input} placeholder="Phone" type="tel" value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      <input className={input} type="date" value={form.moveInDate}
        onChange={(e) => setForm((f) => ({ ...f, moveInDate: e.target.value }))}
        aria-label="Desired move-in date (optional)" />
      {!devMode && (
        <div className="rounded border border-gray-300 px-3 py-2.5">
          <CardElement options={{ style: { base: { fontSize: '14px' } } }} />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting || (!devMode && !clientSecret)}
        className="w-full rounded bg-olive px-5 py-2.5 text-sm font-semibold text-white hover:bg-olive-dark disabled:opacity-60"
      >
        {submitting ? 'Reserving…' : `Reserve for ${formatMoney(reservationFeeCents)}`}
      </button>
    </form>
  )
}
