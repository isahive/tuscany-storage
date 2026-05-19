'use client'

import { useCallback, useEffect, useState, DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { formatMoney, formatDate } from '@/lib/utils'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaymentMethod {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

interface UnitInfo {
  unitNumber: string
  size: string
  monthlyRate: number
}

const GUIDELINES = [
  'I will remove all belongings by the move-out date',
  'I will clean the unit and return it in original condition',
  'I understand final month may be prorated',
  'I confirm there are no outstanding balances',
] as const

const STEPS = ['Confirm Your Information', 'Upload Unit Photos', 'Confirm Submission']

function minMoveOutDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().split('T')[0]
}

function brandLabel(brand: string) {
  const map: Record<string, string> = {
    visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express',
    discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay',
  }
  return map[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1)
}

async function uploadPhoto(file: File): Promise<string> {
  // TODO: replace with real Cloudflare R2 signed-upload flow
  await new Promise((resolve) => setTimeout(resolve, 400))
  return `https://storage.example.com/mock/${file.name.replace(/\s+/g, '-')}`
}

// ─── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ activeStep }: { activeStep: number }) {
  return (
    <ol className="mb-8 flex items-center justify-between gap-2 text-sm">
      {STEPS.map((label, idx) => {
        const active = idx === activeStep
        const done = idx < activeStep
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                done
                  ? 'border-olive bg-olive text-white'
                  : active
                  ? 'border-olive bg-white text-olive-darker'
                  : 'border-gray-300 bg-white text-gray-400'
              }`}
            >
              {done ? '✓' : idx + 1}
            </div>
            <span
              className={`text-center text-xs ${
                active ? 'font-semibold text-olive-darker' : 'text-gray-500'
              }`}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Card-update form ───────────────────────────────────────────────────────

function UpdateCardForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!stripe || !elements) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/setup-intent', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to initialise')

      const card = elements.getElement(CardElement)
      if (!card) throw new Error('Card element not found')

      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(json.clientSecret, {
        payment_method: { card },
      })
      if (stripeError) throw new Error(stripeError.message ?? 'Card setup failed')
      if (!setupIntent?.payment_method) throw new Error('No payment method returned')

      const saveRes = await fetch('/api/portal/save-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId: setupIntent.payment_method }),
      })
      const saveJson = await saveRes.json()
      if (!saveRes.ok || !saveJson.success) throw new Error(saveJson.error ?? 'Failed to save card')

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update card')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="mb-4 rounded border border-gray-300 bg-white px-3 py-3 focus-within:border-olive">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1C0F06',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                '::placeholder': { color: '#9CA3AF' },
              },
              invalid: { color: '#EF4444' },
            },
          }}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !stripe}
          className="rounded bg-olive px-4 py-2 text-sm font-semibold text-white hover:bg-olive-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Card'}
        </button>
      </div>
    </div>
  )
}

// ─── Card-update modal ──────────────────────────────────────────────────────

function CardUpdateModal({
  open, hasCard, onSuccess, onCancel,
}: {
  open: boolean
  hasCard: boolean
  onSuccess: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-semibold text-olive-darker">
          {hasCard ? 'Update Payment Method' : 'Add Payment Method'}
        </h3>
        {stripePromise ? (
          <Elements stripe={stripePromise}>
            <UpdateCardForm onSuccess={onSuccess} onCancel={onCancel} />
          </Elements>
        ) : (
          <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            Online card updates are not available in this environment. Please contact the facility.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 1 ──────────────────────────────────────────────────────────────────

interface Step1Props {
  unit: UnitInfo
  moveOutDate: string
  cardConfirmed: boolean
  checkedGuidelines: Record<string, boolean>
  paymentMethod: PaymentMethod | null
  loadingPayment: boolean
  onDateChange: (v: string) => void
  onCardConfirmedChange: (v: boolean) => void
  onGuidelineChange: (label: string, v: boolean) => void
  onUpdateCard: () => void
  onNext: () => void
}

function Step1({
  unit, moveOutDate, cardConfirmed, checkedGuidelines, paymentMethod,
  loadingPayment, onDateChange, onCardConfirmedChange, onGuidelineChange,
  onUpdateCard, onNext,
}: Step1Props) {
  const allChecked = GUIDELINES.every((g) => checkedGuidelines[g])
  const canProceed = moveOutDate !== '' && cardConfirmed && allChecked

  return (
    <div className="space-y-4">
      {/* Unit info */}
      <section className="rounded border border-gray-200 bg-white p-5">
        <h3 className="mb-3 font-semibold text-gray-900">Your Current Unit</h3>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <div className="text-xs uppercase text-gray-500">Unit Number</div>
            <div className="font-semibold text-gray-900">{unit.unitNumber}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-500">Size</div>
            <div className="font-semibold text-gray-900">{unit.size}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-500">Monthly Rate</div>
            <div className="font-semibold text-gray-900">{formatMoney(unit.monthlyRate)}</div>
          </div>
        </div>
      </section>

      {/* Move-out date */}
      <section className="rounded border border-gray-200 bg-white p-5">
        <h3 className="mb-2 font-semibold text-gray-900">Requested Move-Out Date</h3>
        <p className="mb-3 text-sm text-gray-600">
          Please give at least 30 days&apos; notice. Earliest available:{' '}
          <strong>{formatDate(minMoveOutDate())}</strong>.
        </p>
        <input
          type="date"
          min={minMoveOutDate()}
          value={moveOutDate}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label="Requested move-out date"
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-olive focus:outline-none"
        />
      </section>

      {/* Payment method */}
      <section className="rounded border border-gray-200 bg-white p-5">
        <h3 className="mb-3 font-semibold text-gray-900">Payment Method on File</h3>

        {loadingPayment ? (
          <p className="mb-3 text-sm text-gray-600">Loading…</p>
        ) : paymentMethod ? (
          <div className="mb-3 flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2.5">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {brandLabel(paymentMethod.brand)} •••• {paymentMethod.last4}
              </div>
              <div className="text-xs text-gray-500">
                Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
              </div>
            </div>
            <button
              type="button"
              onClick={onUpdateCard}
              className="text-sm font-semibold text-olive-darker hover:underline"
            >
              Update
            </button>
          </div>
        ) : (
          <div className="mb-3 flex items-center justify-between rounded border border-yellow-200 bg-yellow-50 px-3 py-2.5">
            <p className="text-sm text-yellow-900">
              No payment method on file. Please add a card to continue.
            </p>
            <button
              type="button"
              onClick={onUpdateCard}
              className="rounded bg-olive px-3 py-1.5 text-sm font-semibold text-white hover:bg-olive-dark"
            >
              Add Card
            </button>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={cardConfirmed}
            onChange={(e) => onCardConfirmedChange(e.target.checked)}
            disabled={!paymentMethod}
            className="h-4 w-4 rounded border-gray-300 text-olive focus:ring-olive"
          />
          My payment information is up to date
        </label>
      </section>

      {/* Guidelines */}
      <section className="rounded border border-gray-200 bg-white p-5">
        <h3 className="mb-1 font-semibold text-gray-900">Move-Out Guidelines</h3>
        <p className="mb-3 text-sm text-gray-600">Please confirm each item before continuing.</p>
        <div className="space-y-2">
          {GUIDELINES.map((g) => (
            <label key={g} className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={checkedGuidelines[g] ?? false}
                onChange={(e) => onGuidelineChange(g, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-olive focus:ring-olive"
              />
              {g}
            </label>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canProceed}
          onClick={onNext}
          className="rounded bg-olive px-6 py-2.5 text-sm font-semibold text-white hover:bg-olive-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────

function Step2({
  files, onFilesChange, onNext, onBack,
}: {
  files: File[]
  onFilesChange: (files: File[]) => void
  onNext: () => void
  onBack: () => void
}) {
  const [dragOver, setDragOver] = useState(false)

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return
      const imageFiles = Array.from(incoming).filter((f) => f.type.startsWith('image/'))
      onFilesChange([...files, ...imageFiles])
    },
    [files, onFilesChange],
  )

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  const handleRemove = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Please take at least 2 photos of your empty unit — front, back, and any corners with damage.
        Photos will be uploaded when you submit the form.
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('photo-upload-input')?.click()}
        role="button"
        aria-label="Upload photos"
        className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? 'border-olive bg-olive/5' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <svg className="mx-auto mb-3 h-12 w-12 text-olive" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5M12 7.5L7.5 12M12 7.5v9" />
        </svg>
        <p className="font-medium text-olive-darker">Drag &amp; drop photos here, or click to browse</p>
        <p className="mt-1 text-xs text-gray-500">Accepts JPG, PNG, HEIC — multiple files allowed</p>
        <input
          id="photo-upload-input"
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Selected Photos ({files.length})</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="relative">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="aspect-square w-full rounded border border-gray-200 object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemove(index) }}
                  aria-label={`Remove ${file.name}`}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white hover:bg-black/90"
                >
                  ✕
                </button>
                <p className="mt-1 truncate text-xs text-gray-500">{file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length < 1 && (
        <p className="text-xs text-red-600">At least 1 photo is required to continue.</p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-gray-600 hover:underline"
        >
          Back
        </button>
        <button
          type="button"
          disabled={files.length < 1}
          onClick={onNext}
          className="rounded bg-olive px-6 py-2.5 text-sm font-semibold text-white hover:bg-olive-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// ─── Step 3 ──────────────────────────────────────────────────────────────────

function Step3({
  unit, moveOutDate, cardConfirmed, paymentMethod, photoCount, submitting, onBack, onSubmit,
}: {
  unit: UnitInfo
  moveOutDate: string
  cardConfirmed: boolean
  paymentMethod: PaymentMethod | null
  photoCount: number
  submitting: boolean
  onBack: () => void
  onSubmit: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Please review your submission details before confirming.</p>

      <section className="rounded border border-gray-200 bg-white p-5">
        <h3 className="mb-3 font-semibold text-gray-900">Submission Summary</h3>
        <dl className="divide-y divide-gray-100 text-sm">
          <SummaryRow label="Unit" value={`${unit.unitNumber} (${unit.size})`} />
          <SummaryRow label="Requested Move-Out Date" value={moveOutDate ? formatDate(moveOutDate) : '—'} />
          <SummaryRow
            label="Payment Method"
            value={paymentMethod ? `${brandLabel(paymentMethod.brand)} •••• ${paymentMethod.last4}` : '—'}
          />
          <SummaryRow
            label="Payment Info Confirmed"
            value={
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                  cardConfirmed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {cardConfirmed ? 'Yes' : 'No'}
              </span>
            }
          />
          <SummaryRow label="Photos Attached" value={`${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`} />
        </dl>
      </section>

      <div className="rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
        Once submitted, the admin will review your request and respond within 24 hours.
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="text-sm font-semibold text-gray-600 hover:underline disabled:opacity-60"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded bg-olive px-6 py-2.5 text-sm font-semibold text-white hover:bg-olive-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-gray-600">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  )
}

// ─── Success screen ──────────────────────────────────────────────────────────

function SuccessScreen() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <svg className="h-16 w-16 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h2 className="text-xl font-semibold text-olive-darker">Request Submitted</h2>
      <p className="max-w-md text-sm text-gray-600">
        Your move-out request has been submitted. The admin will review it and respond within
        24 hours. You will receive a confirmation email once a decision has been made.
      </p>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MoveOutPage() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(0)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [unit, setUnit] = useState<UnitInfo | null>(null)
  const [loadingUnit, setLoadingUnit] = useState(true)

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [loadingPayment, setLoadingPayment] = useState(true)
  const [cardDialogOpen, setCardDialogOpen] = useState(false)

  const [moveOutDate, setMoveOutDate] = useState('')
  const [cardConfirmed, setCardConfirmed] = useState(false)
  const [checkedGuidelines, setCheckedGuidelines] = useState<Record<string, boolean>>(
    Object.fromEntries(GUIDELINES.map((g) => [g, false])),
  )

  const [files, setFiles] = useState<File[]>([])

  // Pull active rental from the dashboard endpoint (single source of truth
  // shared with the dashboard page).
  useEffect(() => {
    fetch('/api/portal/dashboard')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data?.rentals?.[0]) {
          const r = j.data.rentals[0]
          setUnit({
            unitNumber: r.unitNumber,
            size: r.size,
            monthlyRate: r.monthlyRate,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoadingUnit(false))
  }, [])

  useEffect(() => {
    fetch('/api/portal/billing-info')
      .then((r) => r.json())
      .then((j) => { if (j.success) setPaymentMethod(j.data.paymentMethod ?? null) })
      .catch(() => {})
      .finally(() => setLoadingPayment(false))
  }, [])

  function handleCardSuccess() {
    setCardDialogOpen(false)
    setLoadingPayment(true)
    fetch('/api/portal/billing-info')
      .then((r) => r.json())
      .then((j) => { if (j.success) setPaymentMethod(j.data.paymentMethod ?? null) })
      .catch(() => {})
      .finally(() => setLoadingPayment(false))
  }

  const handleGuidelineChange = (label: string, value: boolean) => {
    setCheckedGuidelines((prev) => ({ ...prev, [label]: value }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const photoUrls = await Promise.all(files.map((file) => uploadPhoto(file)))
      const res = await fetch('/api/move-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedMoveOutDate: new Date(moveOutDate).toISOString(),
          stripePaymentMethodConfirmed: cardConfirmed,
          lastFourDigits: paymentMethod?.last4 ?? '',
          photoUrls,
          guidelinesAccepted: true,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to submit move-out request.')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingUnit) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-olive border-t-transparent" />
      </div>
    )
  }

  if (!unit) {
    return (
      <div>
        <h1 className="mb-4 font-display text-2xl font-semibold text-olive-darker">Move Out</h1>
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Unable to load unit information. Please try again later.
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div>
        <h1 className="mb-4 font-display text-2xl font-semibold text-olive-darker">Move Out</h1>
        <div className="rounded border border-gray-200 bg-white">
          <SuccessScreen />
          <div className="border-t border-gray-200 p-4 text-center">
            <button
              type="button"
              onClick={() => router.push('/portal')}
              className="rounded bg-olive px-5 py-2 text-sm font-semibold text-white hover:bg-olive-dark"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-olive-darker">Move Out</h1>
      <p className="mb-6 text-sm text-gray-600">Complete the steps below to submit your move-out request.</p>

      <StepIndicator activeStep={activeStep} />

      {error && (
        <div className="mb-4 flex items-start justify-between rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-3 text-red-600 hover:text-red-800">✕</button>
        </div>
      )}

      {activeStep === 0 && (
        <Step1
          unit={unit}
          moveOutDate={moveOutDate}
          cardConfirmed={cardConfirmed}
          checkedGuidelines={checkedGuidelines}
          paymentMethod={paymentMethod}
          loadingPayment={loadingPayment}
          onDateChange={setMoveOutDate}
          onCardConfirmedChange={setCardConfirmed}
          onGuidelineChange={handleGuidelineChange}
          onUpdateCard={() => setCardDialogOpen(true)}
          onNext={() => setActiveStep(1)}
        />
      )}
      {activeStep === 1 && (
        <Step2
          files={files}
          onFilesChange={setFiles}
          onNext={() => setActiveStep(2)}
          onBack={() => setActiveStep(0)}
        />
      )}
      {activeStep === 2 && (
        <Step3
          unit={unit}
          moveOutDate={moveOutDate}
          cardConfirmed={cardConfirmed}
          paymentMethod={paymentMethod}
          photoCount={files.length}
          submitting={submitting}
          onBack={() => setActiveStep(1)}
          onSubmit={handleSubmit}
        />
      )}

      <CardUpdateModal
        open={cardDialogOpen}
        hasCard={!!paymentMethod}
        onSuccess={handleCardSuccess}
        onCancel={() => setCardDialogOpen(false)}
      />
    </div>
  )
}
