'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import ReserveSidebar, { type ChargeBreakdown } from '@/components/public/ReserveSidebar'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

// ─── Types ────────────────────────────────────────────────────────────────────

interface Unit {
  _id: string
  unitNumber: string
  size: string
  sqft: number
  type: string
  floor: string
  price: number
  status: string
  features: string[]
}

interface FormData {
  // Contact Information
  fullName: string
  address: string
  city: string
  state: string
  zip: string
  cellPhone: string
  smsConsent: boolean
  // Personal Information
  idPhotoUrl: string
  driversLicenseNumber: string
  driversLicenseState: string
  // Alternate Contact
  alternateContactName: string
  alternateEmail: string
  alternatePhone: string
  // Login Information
  username: string
  email: string
  password: string
  confirmPassword: string
  // Other Information
  howDidYouHear: string
  howDidYouHearOther: string
  // Billing (step 2)
  billingSameAsContact: boolean
  billingLine1: string
  billingCity: string
  billingState: string
  billingZip: string
  billingCountry: string
  cardholderFirstName: string
  cardholderLastName: string
  saveCard: boolean
}

interface ReserveResult {
  leaseId: string
  clientSecret: string | null
  paymentIntentId: string | null
  devMode: boolean
  totalAmount: number
}

interface FacilityInfo {
  facilityName: string
  facilityPhone: string
}

interface FieldConfig {
  key: string
  label: string
  fieldType?: 'text' | 'select' | 'checkbox'
  options?: string[]
  helpText?: string
  showOnSignup: boolean
  requiredOnSignup: boolean
  showOnWaitingList: boolean
  requiredOnWaitingList: boolean
  isCustom: boolean
  order: number
}

const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ['Personal Information', 'Payment Information', 'Review & Submit']
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((label, i) => {
        const n = i + 1
        const done = step > n
        const active = step === n
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${done ? 'bg-olive text-white' : active ? 'bg-brown text-cream' : 'bg-mid text-muted'}`}>
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : n}
              </div>
              <span className={`mt-1 text-[11px] font-medium hidden sm:block whitespace-nowrap ${active ? 'text-brown' : 'text-muted'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && <div className={`w-12 sm:w-20 h-px mx-1 mb-5 ${step > n ? 'bg-olive' : 'bg-mid'}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Form field config hook ──────────────────────────────────────────────────

function useFormFieldSettings() {
  const [fields, setFields] = useState<FieldConfig[]>([])
  const [facility, setFacility] = useState<FacilityInfo>({
    facilityName: 'Tuscany Village Self Storage',
    facilityPhone: '(865) 426-2100',
  })
  useEffect(() => {
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          if (json.data.customerFormFields) setFields(json.data.customerFormFields)
          setFacility({
            facilityName: json.data.facilityName ?? 'Tuscany Village Self Storage',
            facilityPhone: json.data.facilityPhone ?? '(865) 426-2100',
          })
        }
      })
      .catch(() => {})
  }, [])
  const get = useCallback((key: string) => fields.find((f) => f.key === key), [fields])
  const show = useCallback((key: string) => {
    const f = fields.find((ff) => ff.key === key)
    return !f || f.showOnSignup
  }, [fields])
  const req = useCallback((key: string) => {
    const f = fields.find((ff) => ff.key === key)
    return f?.requiredOnSignup ?? false
  }, [fields])
  return { fields, facility, get, show, req }
}

// ─── Shared inputs ────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', required, hint, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  hint?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brown mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded border border-mid px-3 py-2 text-sm text-brown bg-white focus:border-tan focus:outline-none focus:ring-1 focus:ring-tan/30 transition"
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function SelectField({
  label, value, onChange, options, required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brown mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded border border-mid px-3 py-2 text-sm text-brown bg-white focus:border-tan focus:outline-none focus:ring-1 focus:ring-tan/30 transition"
      >
        <option value="">Select…</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  )
}

function CheckboxField({
  label, checked, onChange, helpText, required,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  helpText?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-mid accent-brown"
        />
        <span className="text-sm text-brown/80 leading-snug">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      </label>
      {helpText && <p className="mt-1 ml-7 text-xs text-muted leading-snug">{helpText}</p>}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-mid/70 mb-4 pb-1">
      <h3 className="text-sm font-bold text-brown uppercase tracking-wide">{children}</h3>
    </div>
  )
}

// ─── Step 1: Personal Information ─────────────────────────────────────────────

function Step1PersonalInfo({
  form, setForm, unit, onDone,
}: {
  form: FormData
  setForm: (f: FormData) => void
  unit: Unit
  onDone: (result: ReserveResult) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState(false)
  const { get, show, req } = useFormFieldSettings()
  const set = <K extends keyof FormData>(k: K) => (v: FormData[K]) => setForm({ ...form, [k]: v })

  // Auto-fill username from email
  useEffect(() => {
    if (form.email && !form.username) {
      setForm({ ...form, username: form.email })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.email])

  async function handleIdUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingId(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/public/upload-id', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Upload failed')
      setForm({ ...form, idPhotoUrl: json.url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ID upload failed')
    } finally {
      setUploadingId(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.fullName.trim()) { setError('Please enter your name'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }

    // Split name on first space
    const nameParts = form.fullName.trim().split(/\s+/)
    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ') || nameParts[0]

    setLoading(true)
    try {
      const res = await fetch('/api/public/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unit._id,
          firstName,
          lastName,
          email: form.email,
          phone: form.cellPhone,
          password: form.password,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          driversLicenseNumber: form.driversLicenseNumber || undefined,
          driversLicenseState: form.driversLicenseState || undefined,
          alternatePhone: form.alternatePhone || undefined,
          alternateEmail: form.alternateEmail || undefined,
          alternateContactName: form.alternateContactName || undefined,
          idPhotoUrl: form.idPhotoUrl || undefined,
          smsConsent: form.smsConsent,
          howDidYouHear: form.howDidYouHear || undefined,
          howDidYouHearOther: form.howDidYouHearOther || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to create account')
      onDone({
        leaseId: json.data.leaseId,
        clientSecret: json.data.clientSecret,
        paymentIntentId: null,
        devMode: json.data.devMode,
        totalAmount: json.data.totalAmount,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const smsConsentField = get('smsConsent')
  const howField = get('howDidYouHear')

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Contact Information */}
      <section>
        <SectionHeader>Contact Information</SectionHeader>
        <div className="space-y-4">
          <Field label="Name" value={form.fullName} onChange={set('fullName')} required placeholder="Full name" />
          {show('address') && (
            <Field label="Address" value={form.address} onChange={set('address')} required={req('address')} />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {show('city') && (
              <Field label="City" value={form.city} onChange={set('city')} required={req('city')} />
            )}
            {show('state') && (
              <Field label="State" value={form.state} onChange={set('state')} required={req('state')} />
            )}
            {show('zip') && (
              <Field label="Zip" value={form.zip} onChange={set('zip')} required={req('zip')} />
            )}
          </div>
          <Field
            label="Cell Phone"
            value={form.cellPhone}
            onChange={set('cellPhone')}
            type="tel"
            required
            hint="Your gate code will default to the last 4 digits of this number"
          />
          {show('smsConsent') && smsConsentField && (
            <CheckboxField
              label={smsConsentField.label}
              checked={form.smsConsent}
              onChange={set('smsConsent')}
              helpText={smsConsentField.helpText}
            />
          )}
        </div>
      </section>

      {/* Personal Information */}
      <section>
        <SectionHeader>Personal Information</SectionHeader>
        <div className="space-y-4">
          {show('idPhoto') && (
            <div>
              <label className="block text-sm font-medium text-brown mb-1">
                Photo ID {req('idPhoto') && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <p className="text-xs text-muted mb-2">Upload a photo of your driver&apos;s license or government-issued ID</p>
              {form.idPhotoUrl ? (
                <div className="relative rounded-lg border border-mid overflow-hidden bg-white">
                  <img src={form.idPhotoUrl} alt="ID" className="w-full max-h-48 object-contain" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, idPhotoUrl: '' })}
                    className="absolute top-2 right-2 text-xs text-red-600 bg-white/90 px-2 py-1 rounded hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-mid rounded-lg cursor-pointer hover:border-tan transition-colors ${uploadingId ? 'opacity-50 pointer-events-none' : ''}`}>
                  <svg className="w-8 h-8 text-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-muted">{uploadingId ? 'Uploading…' : 'Click to upload your ID'}</span>
                  <span className="text-xs text-muted mt-1">JPG, PNG or WebP (max 10MB)</span>
                  <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleIdUpload} />
                </label>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {show('driversLicenseNumber') && (
              <Field
                label="Driver's License Number"
                value={form.driversLicenseNumber}
                onChange={set('driversLicenseNumber')}
                required={req('driversLicenseNumber')}
              />
            )}
            {show('driversLicenseState') && (
              <Field
                label="Driver's License State"
                value={form.driversLicenseState}
                onChange={set('driversLicenseState')}
                required={req('driversLicenseState')}
              />
            )}
          </div>
        </div>
      </section>

      {/* Alternate Contact */}
      {(show('alternateContactName') || show('alternateEmail') || show('alternatePhone')) && (
        <section>
          <SectionHeader>Alternate Contact</SectionHeader>
          <div className="space-y-4">
            {show('alternateContactName') && (
              <Field
                label="Alternate contact"
                value={form.alternateContactName}
                onChange={set('alternateContactName')}
                required={req('alternateContactName')}
              />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {show('alternateEmail') && (
                <Field
                  label="Email"
                  value={form.alternateEmail}
                  onChange={set('alternateEmail')}
                  type="email"
                  required={req('alternateEmail')}
                />
              )}
              {show('alternatePhone') && (
                <Field
                  label="Cell Phone"
                  value={form.alternatePhone}
                  onChange={set('alternatePhone')}
                  type="tel"
                  required={req('alternatePhone')}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Login Information */}
      <section>
        <SectionHeader>Login Information</SectionHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Username" value={form.username} onChange={set('username')} hint="Defaults to your email address" />
            <Field label="Email" value={form.email} onChange={set('email')} type="email" required />
          </div>
          <div>
            <p className="text-xs font-medium text-brown/60 uppercase tracking-wide mb-2">Create Password</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Password"
                value={form.password}
                onChange={set('password')}
                type="password"
                required
                hint="Min. 8 characters"
              />
              <Field
                label="Confirm Password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                type="password"
                required
              />
            </div>
          </div>
        </div>
      </section>

      {/* Other Information */}
      {show('howDidYouHear') && howField && (
        <section>
          <SectionHeader>Other Information</SectionHeader>
          <div className="space-y-4">
            <SelectField
              label={howField.label}
              value={form.howDidYouHear}
              onChange={set('howDidYouHear')}
              options={howField.options ?? []}
              required={req('howDidYouHear')}
            />
            {form.howDidYouHear === 'Other' && show('howDidYouHearOther') && (
              <Field
                label="Tell us more"
                value={form.howDidYouHearOther}
                onChange={set('howDidYouHearOther')}
              />
            )}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-mid">
        <Link href={`/units/${unit._id}`} className="text-sm text-muted hover:text-brown transition-colors">
          ← Back to unit
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-tan px-6 py-2.5 text-sm font-semibold text-brown hover:bg-tan-light transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Continue to Payment →'}
        </button>
      </div>
      <p className="text-center text-xs text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-tan hover:underline font-medium">Sign in</Link>
      </p>
    </form>
  )
}

// ─── Step 2: Payment Information ──────────────────────────────────────────────

function Step2PaymentInfo({
  form, setForm, onBack, onContinue,
}: {
  form: FormData
  setForm: (f: FormData) => void
  onBack: () => void
  onContinue: () => void
}) {
  const set = <K extends keyof FormData>(k: K) => (v: FormData[K]) => setForm({ ...form, [k]: v })
  const [error, setError] = useState<string | null>(null)
  const stripe = useStripe()
  const elements = useElements()

  // Pre-fill cardholder name from contact name on first mount
  useEffect(() => {
    if (!form.cardholderFirstName && !form.cardholderLastName && form.fullName) {
      const parts = form.fullName.trim().split(/\s+/)
      const first = parts[0] ?? ''
      const last = parts.slice(1).join(' ') || first
      setForm({ ...form, cardholderFirstName: first, cardholderLastName: last })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.cardholderFirstName.trim() || !form.cardholderLastName.trim()) {
      setError('Please enter the cardholder name')
      return
    }
    if (!form.billingSameAsContact) {
      if (!form.billingLine1.trim() || !form.billingCity.trim() || !form.billingState.trim() || !form.billingZip.trim()) {
        setError('Please fill in your billing address')
        return
      }
    }
    if (stripe && elements) {
      const card = elements.getElement(CardElement)
      if (!card) {
        setError('Card element not loaded')
        return
      }
    }
    onContinue()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Billing address */}
      <section>
        <SectionHeader>Billing Address</SectionHeader>
        <CheckboxField
          label="My billing information is the same as my contact information"
          checked={form.billingSameAsContact}
          onChange={(v) => {
            if (v) {
              setForm({
                ...form,
                billingSameAsContact: true,
                billingLine1: form.address,
                billingCity: form.city,
                billingState: form.state,
                billingZip: form.zip,
                billingCountry: 'US',
              })
            } else {
              setForm({ ...form, billingSameAsContact: false })
            }
          }}
        />
        {!form.billingSameAsContact && (
          <div className="mt-4 space-y-4">
            <Field label="Address" value={form.billingLine1} onChange={set('billingLine1')} required />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="City" value={form.billingCity} onChange={set('billingCity')} required />
              <Field label="State" value={form.billingState} onChange={set('billingState')} required />
              <Field label="Zip Code" value={form.billingZip} onChange={set('billingZip')} required />
            </div>
            <Field label="Country" value={form.billingCountry} onChange={set('billingCountry')} required placeholder="US" />
          </div>
        )}
      </section>

      {/* Payment method */}
      <section>
        <SectionHeader>Payment Method</SectionHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brown mb-1">Payment Type</label>
            <select
              value="credit_card"
              onChange={() => { /* only credit_card supported for now */ }}
              className="w-full rounded border border-mid px-3 py-2 text-sm text-brown bg-white focus:border-tan focus:outline-none focus:ring-1 focus:ring-tan/30"
            >
              <option value="credit_card">Credit Card</option>
              <option value="ach" disabled>ACH (coming soon)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="First Name (Cardholder)"
              value={form.cardholderFirstName}
              onChange={set('cardholderFirstName')}
              required
            />
            <Field
              label="Last Name (Cardholder)"
              value={form.cardholderLastName}
              onChange={set('cardholderLastName')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brown mb-1">Card Details</label>
            <div className="rounded border border-mid p-3 bg-white focus-within:border-tan transition-colors">
              <CardElement options={{
                style: {
                  base: { fontSize: '15px', color: '#1C0F06', '::placeholder': { color: '#9CA3AF' } },
                  invalid: { color: '#EF4444' },
                },
              }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">Test card: 4242 4242 4242 4242 · Any future date · Any CVC</p>
          </div>

          <CheckboxField
            label="Save this card on file for future monthly payments"
            checked={form.saveCard}
            onChange={set('saveCard')}
          />
        </div>
      </section>

      <div className="flex items-center justify-between pt-4 border-t border-mid">
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-brown transition-colors">
          ← Back
        </button>
        <button
          type="submit"
          className="rounded bg-tan px-6 py-2.5 text-sm font-semibold text-brown hover:bg-tan-light transition-colors"
        >
          Continue to Review →
        </button>
      </div>
    </form>
  )
}

// (Stripe wrapping is hoisted to PaymentSteps so CardElement persists between
// step 2 and step 3.)

// ─── Signature pad (kept from previous version) ───────────────────────────────

function SignaturePad({
  onChange,
}: {
  onChange: (data: string | null, type: 'drawn' | 'typed') => void
}) {
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [typedName, setTypedName] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const src = 'touches' in e ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    onChange(null, 'drawn')
  }, [onChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#1C0F06'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      drawing.current = true
      lastPos.current = getPos(e, canvas)
    }
    const move = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      if (!drawing.current || !lastPos.current) return
      const pos = getPos(e, canvas)
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastPos.current = pos
    }
    const end = () => {
      drawing.current = false
      lastPos.current = null
      onChange(canvas.toDataURL(), 'drawn')
    }

    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', move)
    canvas.addEventListener('mouseup', end)
    canvas.addEventListener('mouseleave', end)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove', move, { passive: false })
    canvas.addEventListener('touchend', end)
    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', move)
      canvas.removeEventListener('mouseup', end)
      canvas.removeEventListener('mouseleave', end)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', move)
      canvas.removeEventListener('touchend', end)
    }
  }, [onChange])

  useEffect(() => {
    if (mode !== 'type') return
    if (!typedName.trim()) {
      onChange(null, 'typed')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = 500
    canvas.height = 120
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#1C0F06'
    ctx.font = '56px "Dancing Script", cursive'
    ctx.textBaseline = 'middle'
    ctx.fillText(typedName, 20, 64)
    onChange(canvas.toDataURL(), 'typed')
  }, [typedName, mode, onChange])

  return (
    <div>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" />
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 bg-mid/30 rounded-lg p-1 w-fit">
          {(['draw', 'type'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                onChange(null, m === 'draw' ? 'drawn' : 'typed')
                clearCanvas()
              }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === m ? 'bg-white text-brown shadow-sm' : 'text-muted hover:text-brown'}`}
            >
              {m === 'draw' ? 'Draw' : 'Type'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (mode === 'draw') clearCanvas()
            else { setTypedName(''); onChange(null, 'typed') }
          }}
          className="text-xs text-tan hover:underline font-medium"
        >
          Clear Signature
        </button>
      </div>

      {mode === 'draw' ? (
        <canvas
          ref={canvasRef}
          width={560}
          height={120}
          className="w-full border border-mid rounded-lg bg-white cursor-crosshair touch-none"
          style={{ height: '120px' }}
        />
      ) : (
        <div>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your full name"
            className="w-full rounded border border-mid px-3 py-2 text-sm text-brown focus:border-tan focus:outline-none mb-3"
          />
          {typedName && (
            <div
              className="w-full border border-mid rounded-lg bg-white px-4 py-3"
              style={{
                fontFamily: '"Dancing Script", cursive',
                fontSize: '2.5rem',
                color: '#1C0F06',
                minHeight: '80px',
                lineHeight: 1.2,
              }}
            >
              {typedName}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 3: Review & Submit ──────────────────────────────────────────────────

function Step3ReviewSubmit({
  form, unit, leaseId, paymentIntentId, clientSecret, devMode, dueTotal,
  promoCode, protectionPlanId, tenantName, onBack, onSuccess,
}: {
  form: FormData
  unit: Unit
  leaseId: string
  paymentIntentId: string | null
  clientSecret: string | null
  devMode: boolean
  dueTotal: number
  promoCode: string
  protectionPlanId: string | null
  tenantName: string
  onBack: () => void
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [html, setHtml] = useState('')
  const [title, setTitle] = useState('Storage Rental Agreement')
  const [loadingDoc, setLoadingDoc] = useState(true)
  const [docError, setDocError] = useState<string | null>(null)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [signatureType, setSignatureType] = useState<'drawn' | 'typed'>('drawn')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  useEffect(() => {
    fetch(`/api/public/agreement/${leaseId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setHtml(json.data.html)
          setTitle(json.data.title)
        } else {
          setDocError(json.error ?? 'Could not load agreement')
        }
      })
      .catch(() => setDocError('Could not load agreement'))
      .finally(() => setLoadingDoc(false))
  }, [leaseId])

  const handleSigChange = useCallback((data: string | null, type: 'drawn' | 'typed') => {
    setSignatureData(data)
    setSignatureType(type)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!signatureData) { setError('Please provide your signature'); return }
    if (!agreed) { setError('Please confirm you agree to the terms'); return }

    setSubmitting(true)
    try {
      // 1. Refresh intent amount (in case sidebar updated charges since step 2)
      let activeIntentId: string | null = paymentIntentId
      let activeClientSecret: string | null = clientSecret

      if (!devMode) {
        const updateRes = await fetch('/api/public/reserve/update-amount', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leaseId,
            promoCode: promoCode || undefined,
            protectionPlanId: protectionPlanId || null,
          }),
        })
        const updateJson = await updateRes.json()
        if (updateJson.success && updateJson.data) {
          activeClientSecret = updateJson.data.clientSecret ?? activeClientSecret
          activeIntentId = updateJson.data.paymentIntentId ?? activeIntentId
        }
      }

      // 2. Confirm payment client-side
      let confirmedIntentId: string | undefined
      if (!devMode && activeClientSecret) {
        if (!stripe || !elements) throw new Error('Stripe not loaded')
        const card = elements.getElement(CardElement)
        if (!card) throw new Error('Card element not found')

        const billingName =
          `${form.cardholderFirstName} ${form.cardholderLastName}`.trim() || tenantName
        const billingDetails = {
          name: billingName,
          email: form.email,
          phone: form.cellPhone,
          address: form.billingSameAsContact
            ? {
                line1: form.address,
                city: form.city,
                state: form.state,
                postal_code: form.zip,
                country: 'US',
              }
            : {
                line1: form.billingLine1,
                city: form.billingCity,
                state: form.billingState,
                postal_code: form.billingZip,
                country: form.billingCountry || 'US',
              },
        }

        const { paymentIntent, error: stripeErr } = await stripe.confirmCardPayment(activeClientSecret, {
          payment_method: { card, billing_details: billingDetails },
        })
        if (stripeErr) throw new Error(stripeErr.message ?? 'Payment failed')
        if (paymentIntent?.status !== 'succeeded') throw new Error('Payment did not complete')
        confirmedIntentId = paymentIntent.id
      }

      // 3. Finalize on server
      const finalizeRes = await fetch('/api/public/reserve/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaseId,
          paymentIntentId: confirmedIntentId,
          signatureData,
          signatureType,
          saveCard: form.saveCard,
          billingAddress: form.billingSameAsContact
            ? {
                line1: form.address,
                city: form.city,
                state: form.state,
                zip: form.zip,
                country: 'US',
              }
            : {
                line1: form.billingLine1,
                city: form.billingCity,
                state: form.billingState,
                zip: form.billingZip,
                country: form.billingCountry || 'US',
              },
          promoCode: promoCode || undefined,
          protectionPlanId: protectionPlanId || null,
        }),
      })
      const finalizeJson = await finalizeRes.json()
      if (!finalizeRes.ok || !finalizeJson.success) {
        throw new Error(finalizeJson.error ?? 'Could not complete rental')
      }

      // 4. Sign in
      await signIn('credentials', { email: form.email, password: form.password, redirect: false })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Document */}
      <div>
        <SectionHeader>Storage Agreement</SectionHeader>
        <div className="border border-mid rounded-xl overflow-hidden">
          <div className="bg-brown px-4 py-2.5 flex items-center justify-between">
            <span className="text-cream text-sm font-semibold">{title}</span>
            <span className="text-cream/60 text-xs">Read before signing</span>
          </div>
          <div className="bg-gray-100 p-4" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {loadingDoc ? (
              <div className="flex items-center justify-center py-16 text-muted text-sm">Loading agreement…</div>
            ) : docError ? (
              <div className="text-red-600 text-sm p-4 bg-red-50 rounded">{docError}</div>
            ) : (
              <div
                className="bg-white mx-auto shadow-sm rounded p-8"
                style={{
                  maxWidth: '720px',
                  fontFamily: 'Georgia, serif',
                  fontSize: '14px',
                  lineHeight: 1.75,
                  color: '#1C0F06',
                }}
              >
                <div dangerouslySetInnerHTML={{ __html: html }} />
                <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #ccc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ borderBottom: '1px solid #1C0F06', minHeight: '48px', display: 'flex', alignItems: 'flex-end', paddingBottom: '2px', marginBottom: '4px' }}>
                        {signatureData ? (
                          <img src={signatureData} alt="Signature" style={{ height: '44px', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ color: '#9CA3AF', fontSize: '12px', fontStyle: 'italic' }}>Sign below ↓</span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: '#6B7280' }}>Tenant Signature</span>
                    </div>
                    <div style={{ minWidth: '140px' }}>
                      <div style={{ borderBottom: '1px solid #1C0F06', minHeight: '48px', display: 'flex', alignItems: 'flex-end', paddingBottom: '4px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px' }}>{tenantName}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#6B7280' }}>Printed Name</span>
                    </div>
                    <div style={{ minWidth: '120px' }}>
                      <div style={{ borderBottom: '1px solid #1C0F06', minHeight: '48px', display: 'flex', alignItems: 'flex-end', paddingBottom: '4px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px' }}>{today}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#6B7280' }}>Date</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signature */}
      <div>
        <SectionHeader>Agreement Signature</SectionHeader>
        <div className="border border-mid rounded-xl p-5 bg-cream">
          <SignaturePad onChange={handleSigChange} />
        </div>
      </div>

      {/* Agreement checkbox */}
      <CheckboxField
        label="I have read and agreed to the above agreement(s)."
        checked={agreed}
        onChange={setAgreed}
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-mid">
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-brown transition-colors">
          ← Back
        </button>
        <button
          type="submit"
          disabled={submitting || !signatureData || !agreed || (!devMode && !stripe)}
          className="rounded bg-brown px-6 py-3 text-sm font-semibold text-cream hover:bg-brown/90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Processing…' : `Submit and Pay ${fmt(dueTotal)}`}
        </button>
      </div>
    </form>
  )
}

// ─── Shared Stripe wrapper for steps 2 + 3 ────────────────────────────────────
// Both steps live under the same <Elements> instance so the CardElement
// persists when the user moves between them.

interface PaymentStepsProps {
  step: number
  form: FormData
  setForm: (f: FormData) => void
  unit: Unit
  reserveResult: ReserveResult
  promoCode: string
  protectionPlanId: string | null
  dueTotal: number
  tenantName: string
  onBackToStep1: () => void
  onContinueToStep3: () => void
  onBackToStep2: () => void
  onSuccess: () => void
}

function PaymentStepsInner({
  step, form, setForm, unit, reserveResult, promoCode, protectionPlanId,
  dueTotal, tenantName, onBackToStep1, onContinueToStep3, onBackToStep2, onSuccess,
}: PaymentStepsProps) {
  return (
    <>
      <div style={{ display: step === 2 ? 'block' : 'none' }}>
        <Step2PaymentInfo
          form={form}
          setForm={setForm}
          onBack={onBackToStep1}
          onContinue={onContinueToStep3}
        />
      </div>
      {step === 3 && (
        <Step3ReviewSubmit
          form={form}
          unit={unit}
          leaseId={reserveResult.leaseId}
          paymentIntentId={reserveResult.paymentIntentId}
          clientSecret={reserveResult.clientSecret}
          devMode={reserveResult.devMode}
          dueTotal={dueTotal}
          promoCode={promoCode}
          protectionPlanId={protectionPlanId}
          tenantName={tenantName}
          onBack={onBackToStep2}
          onSuccess={onSuccess}
        />
      )}
    </>
  )
}

function PaymentSteps(props: PaymentStepsProps) {
  return stripePromise ? (
    <Elements stripe={stripePromise}>
      <PaymentStepsInner {...props} />
    </Elements>
  ) : (
    <PaymentStepsInner {...props} />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReservePage() {
  const params = useParams()
  const router = useRouter()
  const unitId = params.unitId as string
  const { status: sessionStatus } = useSession()

  const [unit, setUnit] = useState<Unit | null>(null)
  const [loadingUnit, setLoadingUnit] = useState(true)
  const [unitError, setUnitError] = useState(false)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({
    fullName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    cellPhone: '',
    smsConsent: false,
    idPhotoUrl: '',
    driversLicenseNumber: '',
    driversLicenseState: '',
    alternateContactName: '',
    alternateEmail: '',
    alternatePhone: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    howDidYouHear: '',
    howDidYouHearOther: '',
    billingSameAsContact: true,
    billingLine1: '',
    billingCity: '',
    billingState: '',
    billingZip: '',
    billingCountry: 'US',
    cardholderFirstName: '',
    cardholderLastName: '',
    saveCard: true,
  })
  const [reserveResult, setReserveResult] = useState<ReserveResult | null>(null)
  const [recoveredName, setRecoveredName] = useState('')

  // Sidebar inputs
  const [protectionPlanId, setProtectionPlanId] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [breakdown, setBreakdown] = useState<ChargeBreakdown | null>(null)

  const signDate = useMemo(() => new Date(), [])

  const { facility } = useFormFieldSettings()

  // Load unit
  useEffect(() => {
    if (!unitId) return
    fetch(`/api/units/${unitId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) setUnit(json.data)
        else setUnitError(true)
      })
      .catch(() => setUnitError(true))
      .finally(() => setLoadingUnit(false))
  }, [unitId])

  // If user already authenticated and has an unsigned lease, resume
  useEffect(() => {
    if (sessionStatus !== 'authenticated' || step !== 1) return
    fetch('/api/portal/active-lease')
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) return
        if (json.data.signedAt) {
          router.push('/portal')
        } else {
          setReserveResult({
            leaseId: json.data.leaseId,
            clientSecret: null,
            paymentIntentId: null,
            devMode: true,
            totalAmount: 0,
          })
          setRecoveredName(json.data.tenantName)
          setStep(3)
        }
      })
      .catch(() => {})
  }, [sessionStatus, step, router])

  // When the user lands on Step 3, also when promo/protection change there,
  // refresh the intent amount so confirm uses the latest total.
  useEffect(() => {
    if (step !== 3 || !reserveResult || reserveResult.devMode) return
    fetch('/api/public/reserve/update-amount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leaseId: reserveResult.leaseId,
        promoCode: promoCode || undefined,
        protectionPlanId,
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setReserveResult((prev) =>
            prev
              ? {
                  ...prev,
                  clientSecret: json.data.clientSecret ?? prev.clientSecret,
                  paymentIntentId: json.data.paymentIntentId ?? prev.paymentIntentId,
                  totalAmount: json.data.amount ?? prev.totalAmount,
                }
              : prev,
          )
        }
      })
      .catch(() => {})
  }, [step, reserveResult?.leaseId, reserveResult?.devMode, promoCode, protectionPlanId, reserveResult])

  if (loadingUnit) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    )
  }
  if (unitError || !unit) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <p className="font-serif text-2xl text-brown mb-4">Unit not found</p>
        <Link href="/units" className="text-tan hover:underline">Browse all units</Link>
      </div>
    )
  }
  if (unit.status !== 'available' && step === 1) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <p className="font-serif text-2xl text-brown mb-2">This unit is no longer available</p>
        <p className="text-muted mb-6">Browse other available units or join the waiting list.</p>
        <Link
          href="/units"
          className="rounded bg-tan px-6 py-2.5 text-sm font-semibold text-brown hover:bg-tan-light"
        >
          Browse Units
        </Link>
      </div>
    )
  }

  const tenantName =
    form.fullName.trim() || recoveredName ||
    (form.cardholderFirstName ? `${form.cardholderFirstName} ${form.cardholderLastName}` : '')

  const dueTotal = breakdown?.dueToday.total ?? reserveResult?.totalAmount ?? unit.price * 2

  return (
    <div className="min-h-screen bg-cream py-12 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-tan mb-1">Reserve Your Unit</p>
          <h1 className="font-serif text-3xl font-bold text-brown">Complete Your Rental</h1>
        </div>

        <StepIndicator step={step} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-mid shadow-sm p-6 sm:p-8">
              {step === 1 && (
                <Step1PersonalInfo
                  form={form}
                  setForm={setForm}
                  unit={unit}
                  onDone={(result) => {
                    setReserveResult(result)
                    setStep(2)
                  }}
                />
              )}

              {(step === 2 || step === 3) && reserveResult && (
                <PaymentSteps
                  step={step}
                  form={form}
                  setForm={setForm}
                  unit={unit}
                  reserveResult={reserveResult}
                  promoCode={promoCode}
                  protectionPlanId={protectionPlanId}
                  dueTotal={dueTotal}
                  tenantName={tenantName}
                  onBackToStep1={() => setStep(1)}
                  onContinueToStep3={() => setStep(3)}
                  onBackToStep2={() => setStep(2)}
                  onSuccess={() => router.push('/portal?welcome=1')}
                />
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <ReserveSidebar
              unit={unit}
              signDate={signDate}
              protectionPlanId={protectionPlanId}
              onProtectionPlanChange={setProtectionPlanId}
              promoCode={promoCode}
              onPromoCodeApply={setPromoCode}
              onChargesUpdate={setBreakdown}
              facility={facility}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
