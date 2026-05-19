'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js'

declare global {
  interface Window {
    __payTurnstile?: (token: string) => void
    turnstile?: { reset: (widget?: string | HTMLElement) => void }
  }
}

interface VerificationStatus {
  required: boolean
  reason?: string
}

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineItem {
  id: string
  dateCreated: string
  type: string
  description: string
  amount: number
  tax: number
  due: number
  unitNumber: string | null
}

interface StatementData {
  lineItems: LineItem[]
  units: { unitId: string; unitNumber: string; size: string }[]
  credit: number
  outstanding: number
  total: number
}

interface SavedCard {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

interface TenantInfo {
  firstName: string
  lastName: string
  address: string
  city: string
  state: string
  zip: string
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  rent: 'Rent',
  late_fee: 'Past Due Fee',
  deposit: 'Security Deposit',
  prorated: 'Prorated',
  other: 'Fee',
}

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '')
}

function itemDescription(item: LineItem): string {
  const label = PAYMENT_TYPE_LABEL[item.type] ?? item.type
  if (item.description?.trim()) return `${label} – ${item.description}`
  const unitPart = item.unitNumber ? ` for unit ${item.unitNumber}` : ''
  return `${label}${unitPart} ${fmtMoney(item.amount)}`
}

// ─── Inner form (inside Stripe Elements) ─────────────────────────────────────

function MakePaymentForm({
  statement, tenant, savedCard, verification, onVerificationChange, onSuccess,
}: {
  statement: StatementData
  tenant: TenantInfo
  savedCard: SavedCard | null
  verification: VerificationStatus
  onVerificationChange: () => Promise<void> | void
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [amount, setAmount] = useState((statement.total / 100).toFixed(2))
  const [method, setMethod] = useState<'one_time' | 'saved'>(savedCard ? 'saved' : 'one_time')
  const [saveForFuture, setSaveForFuture] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')

  // Storable parity — verification widget surfaces only when the backend says
  // the tenant has tripped one of the four thresholds (5 fails in a row,
  // 5 screen opens w/o success, paying without rental, etc.).
  useEffect(() => {
    if (!verification.required) return
    window.__payTurnstile = (token: string) => setTurnstileToken(token)
    return () => {
      window.__payTurnstile = undefined
    }
  }, [verification.required])

  function resetTurnstile() {
    setTurnstileToken('')
    try { window.turnstile?.reset() } catch { /* noop */ }
  }

  function applyAmount() {
    // Force the amount input to the typed value (mirrors live "Apply Amount"
    // which echoes the chosen amount above the form).
    const n = Number(amount)
    if (Number.isFinite(n) && n > 0) {
      setAmount(n.toFixed(2))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amountCents = Math.round(Number(amount) * 100)
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError('Enter a valid payment amount.')
      return
    }

    if (verification.required && !turnstileToken) {
      setError('Please complete the verification challenge before continuing.')
      return
    }

    setSubmitting(true)
    try {
      // Step 1 — ask backend to create a PaymentIntent.
      const intentRes = await fetch('/api/portal/pay-multi/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountCents, turnstileToken: turnstileToken || undefined }),
      })
      const intentJson = await intentRes.json()
      if (!intentRes.ok || !intentJson.success) {
        // Server reports verification is now required (tripped between page
        // load and submit). Force the widget to render and ask the user to
        // retry — token has already been consumed.
        if (intentJson?.verificationRequired) {
          resetTurnstile()
          onVerificationChange()
        }
        throw new Error(intentJson.error ?? 'Could not start payment')
      }

      // Step 2 — confirm with Stripe Elements. Client-side `confirmCardPayment`
      // is what handles 3D Secure challenges interactively. Doing this on the
      // server with `confirm:true` returns `status:requires_action` and the
      // payment never completes — that's where the live error "Payment
      // confirmation required" was coming from.
      let paymentIntentId: string | undefined

      if (intentJson.data.devMode) {
        // No Stripe key — skip confirmation; backend will mock the intent id.
        paymentIntentId = undefined
      } else {
        if (!stripe || !elements) throw new Error('Card form not loaded yet.')

        let confirmOptions: any
        if (method === 'one_time') {
          const cardEl = elements.getElement(CardNumberElement)
          if (!cardEl) throw new Error('Card number field missing.')
          // Billing details come straight from the tenant record — no need to
          // re-collect the address/name we already captured at agreement signing.
          confirmOptions = {
            payment_method: {
              card: cardEl,
              billing_details: {
                name: `${tenant.firstName} ${tenant.lastName}`.trim(),
                address: {
                  line1: tenant.address || undefined,
                  city: tenant.city || undefined,
                  state: tenant.state || undefined,
                  postal_code: tenant.zip || undefined,
                  country: 'US',
                },
              },
            },
          }
        } else {
          // Saved-card path — pass the PM id explicitly. Falling back to
          // `undefined` (Stripe-pick-the-default) silently fails when the
          // customer has no `default_payment_method` set on Stripe.
          if (!savedCard?.id) throw new Error('Saved card unavailable. Please pick another method.')
          confirmOptions = { payment_method: savedCard.id }
        }

        const { paymentIntent, error: stripeErr } = await stripe.confirmCardPayment(
          intentJson.data.clientSecret,
          confirmOptions,
        )
        if (stripeErr) {
          // Card-side decline never reaches our finalize endpoint, so the
          // failed-streak would never bump. Report it explicitly so the
          // Storable "5 in a row" trigger still works. Awaiting the report
          // before the status refresh ensures the widget appears on the same
          // attempt that trips the threshold (not the one after).
          await fetch('/api/portal/pay-multi/record-decline', { method: 'POST' }).catch(() => {})
          resetTurnstile()
          await onVerificationChange()
          throw new Error(stripeErr.message ?? 'Card declined')
        }
        if (!paymentIntent || paymentIntent.status !== 'succeeded') {
          await fetch('/api/portal/pay-multi/record-decline', { method: 'POST' }).catch(() => {})
          resetTurnstile()
          await onVerificationChange()
          throw new Error('Payment was not completed. Please try again.')
        }
        paymentIntentId = paymentIntent.id
      }

      // Step 3 — finalize on the backend (apply oldest-first + create Payment row).
      const res = await fetch('/api/portal/pay-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountCents,
          paymentIntentId,
          saveForFuture: method === 'one_time' && saveForFuture,
          turnstileToken: turnstileToken || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        if (json?.verificationRequired) {
          resetTurnstile()
          onVerificationChange()
        }
        throw new Error(json.error ?? 'Payment failed')
      }

      onSuccess()
      setTimeout(() => router.push('/portal'), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-olive focus:outline-none'
  const labelClass = 'mb-1 block text-sm font-semibold text-gray-900'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Line items table */}
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-900">
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
              <th className="px-3 py-2 text-right font-semibold">Tax</th>
              <th className="px-3 py-2 text-right font-semibold">Due</th>
            </tr>
          </thead>
          <tbody>
            {statement.lineItems.map((it) => (
              <tr key={it.id} className="border-b border-gray-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                  <div>{fmtDate(it.dateCreated)}</div>
                  <div className="text-xs text-gray-500">{fmtTime(it.dateCreated)}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-700">{it.id.slice(-9)}</td>
                <td className="px-3 py-2 text-gray-800">{itemDescription(it)}</td>
                <td className="px-3 py-2 text-right text-gray-800">{fmtMoney(it.amount)}</td>
                <td className="px-3 py-2 text-right text-gray-800">{fmtMoney(it.tax)}</td>
                <td className="px-3 py-2 text-right text-gray-900">{fmtMoney(it.due)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4}></td>
              <td className="pt-3 pr-3 text-right text-gray-700">Subtotal:</td>
              <td className="pt-3 pr-3 text-right text-gray-900">{fmtMoney(statement.outstanding)}</td>
            </tr>
            <tr>
              <td colSpan={4}></td>
              <td className="pt-1 pr-3 text-right text-gray-700">Credit:</td>
              <td className="pt-1 pr-3 text-right text-gray-900">{fmtMoney(statement.credit)}</td>
            </tr>
            <tr>
              <td colSpan={4}></td>
              <td className="pt-2 pb-3 pr-3 text-right font-semibold text-gray-900">Total:</td>
              <td className="pt-2 pb-3 pr-3 text-right font-bold text-gray-900">{fmtMoney(statement.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600">
        An arbitrary payment will pay the amount towards as many due invoice line items as possible,
        in the order of oldest first. If there is any credit it will be applied first. Then if there
        is any remaining amount left over (or there is not enough to pay a line item in full) it will
        be added to the credit.
      </p>

      {/* Amount + Apply Amount */}
      <div>
        <label className={labelClass} htmlFor="amount">Amount</label>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-l border border-r-0 border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600">
            $
          </span>
          <input
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
            className="w-40 rounded-r border border-gray-300 px-3 py-2 text-sm focus:border-olive focus:outline-none"
          />
          <button
            type="button"
            onClick={applyAmount}
            className="rounded bg-olive px-3 py-2 text-sm font-semibold text-white hover:bg-olive-dark"
          >
            Apply Amount
          </button>
        </div>
      </div>

      {/* Payment method — two radio cards so it's obvious whether you're
          paying with a card on file or entering a new one. */}
      <fieldset>
        <legend className={labelClass}>Payment method</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {savedCard && (
            <label
              className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition-colors ${
                method === 'saved'
                  ? 'border-olive bg-olive/5 ring-1 ring-olive'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="method"
                value="saved"
                checked={method === 'saved'}
                onChange={() => setMethod('saved')}
                className="mt-1 h-4 w-4 text-olive focus:ring-olive"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">Use card on file</div>
                <div className="mt-0.5 text-xs text-gray-600">
                  {savedCard.brand.toUpperCase()} •••• {savedCard.last4} · expires {savedCard.expMonth}/{savedCard.expYear}
                </div>
              </div>
            </label>
          )}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition-colors ${
              method === 'one_time'
                ? 'border-olive bg-olive/5 ring-1 ring-olive'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            <input
              type="radio"
              name="method"
              value="one_time"
              checked={method === 'one_time'}
              onChange={() => setMethod('one_time')}
              className="mt-1 h-4 w-4 text-olive focus:ring-olive"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-900">
                {savedCard ? 'Use a different card' : 'Pay with credit / debit card'}
              </div>
              <div className="mt-0.5 text-xs text-gray-600">
                Enter your card details below.
              </div>
            </div>
          </label>
        </div>
      </fieldset>

      {/* Card fields — only when entering a new card. Name + billing address
          come from the tenant record we already have on file from the storage
          agreement, so no need to re-collect them here. */}
      {method === 'one_time' && (
        <div className="space-y-4 rounded border border-gray-200 bg-gray-50 p-4">
          <div>
            <label className={labelClass}>Card Number</label>
            <div className="rounded border border-gray-300 bg-white px-3 py-2.5 focus-within:border-olive">
              <CardNumberElement options={{ style: { base: { fontSize: '14px' } } }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Expiration</label>
              <div className="rounded border border-gray-300 bg-white px-3 py-2.5 focus-within:border-olive">
                <CardExpiryElement options={{ style: { base: { fontSize: '14px' } } }} />
              </div>
            </div>
            <div>
              <label className={labelClass}>CVV</label>
              <div className="rounded border border-gray-300 bg-white px-3 py-2.5 focus-within:border-olive">
                <CardCvcElement options={{ style: { base: { fontSize: '14px' } } }} />
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={saveForFuture}
              onChange={(e) => setSaveForFuture(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-olive focus:ring-olive"
            />
            <span>
              Save this card for future payments
              <span className="ml-1 block text-xs text-gray-500">
                We&apos;ll keep it on file so you can pay faster next time and enable autopay.
              </span>
            </span>
          </label>
        </div>
      )}

      {/* Verification challenge — Storable parity. Only rendered after the
          tenant trips one of the anti-fraud thresholds. */}
      {verification.required && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs text-amber-900">
            For your security, please complete this verification before submitting payment.
            {verification.reason ? ` (${verification.reason})` : ''}
          </p>
          <div
            className="cf-turnstile"
            data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'}
            data-callback="__payTurnstile"
          />
        </div>
      )}

      {/* Submit row */}
      <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
        <button
          type="submit"
          disabled={submitting || !stripe || (verification.required && !turnstileToken)}
          className="rounded bg-olive px-6 py-2 text-sm font-semibold text-white hover:bg-olive-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Processing…' : 'Make Payment'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/portal/payments')}
          className="text-sm font-semibold text-[#3E5DAA] underline hover:no-underline"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Page wrapper ────────────────────────────────────────────────────────────

export default function MakePaymentPage() {
  const router = useRouter()
  const _searchParams = useSearchParams() // reserved for prepay?prepay=1&unitId=
  const { data: session } = useSession()

  const [statement, setStatement] = useState<StatementData | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null)
  const [verification, setVerification] = useState<VerificationStatus>({ required: false })
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  // React StrictMode mounts twice in dev — without a guard the screen-open
  // counter would double-count every page load and prematurely trip Storable's
  // "5 opens without a success" threshold.
  const screenOpenLogged = useRef(false)

  const refreshVerification = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/verification-status')
      const json = await res.json()
      if (json.success) {
        setVerification({
          required: !!json.data.required,
          reason: json.data.reason,
        })
      }
    } catch {
      /* non-fatal */
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, dRes, bRes, vRes] = await Promise.all([
        fetch('/api/portal/statement'),
        fetch('/api/portal/dashboard'),
        fetch('/api/portal/billing-info'),
        fetch('/api/portal/verification-status'),
      ])
      const [sJson, dJson, bJson, vJson] = await Promise.all([
        sRes.json(), dRes.json(), bRes.json(), vRes.json(),
      ])
      if (sJson.success) setStatement(sJson.data)
      if (dJson.success) {
        setTenant({
          firstName: dJson.data.contact.firstName,
          lastName: dJson.data.contact.lastName,
          address: dJson.data.contact.address,
          city: dJson.data.contact.city,
          state: dJson.data.contact.state,
          zip: dJson.data.contact.zip,
        })
      }
      if (bJson.success && bJson.data.paymentMethod) setSavedCard(bJson.data.paymentMethod)
      if (vJson.success) {
        setVerification({
          required: !!vJson.data.required,
          reason: vJson.data.reason,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Bump the "Make a Payment opened" counter exactly once per landing.
  useEffect(() => {
    if (screenOpenLogged.current) return
    screenOpenLogged.current = true
    fetch('/api/portal/payment-screen-open', { method: 'POST' })
      .then(() => refreshVerification())
      .catch(() => {})
  }, [refreshVerification])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-olive border-t-transparent" />
      </div>
    )
  }

  if (!statement || !tenant) {
    return (
      <div className="rounded border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-700">Unable to load payment form. Please refresh.</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl rounded border border-gray-200 bg-white py-10 text-center">
        <svg className="mx-auto mb-3 h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="font-display text-xl font-semibold text-olive-darker">Payment successful</h2>
        <p className="mt-2 text-sm text-gray-600">Redirecting to your dashboard…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      {verification.required && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="lazyOnload"
        />
      )}
      <section className="rounded border border-gray-200 bg-white">
        <header className="border-b border-gray-200 px-4 py-3 text-center">
          <h1 className="font-display text-xl font-semibold text-olive-darker">Make Payment</h1>
        </header>
        <div className="px-6 py-5">
          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <MakePaymentForm
                statement={statement}
                tenant={tenant}
                savedCard={savedCard}
                verification={verification}
                onVerificationChange={refreshVerification}
                onSuccess={() => setSuccess(true)}
              />
            </Elements>
          ) : (
            <div className="rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
              Online payments are not configured in this environment. Please contact the facility.
            </div>
          )}
        </div>
      </section>

      {!session?.user && (
        <p className="mt-4 text-center text-sm text-gray-500">
          <button onClick={() => router.push('/login')} className="underline">Sign in</button> to continue.
        </p>
      )}
    </div>
  )
}
