'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

// ─── Types ────────────────────────────────────────────────────────────────────

interface Unit {
  _id: string; unitNumber: string; size: string; sqft: number
  type: string; floor: string; price: number; status: string; features: string[]
}
interface FormData {
  firstName: string; lastName: string; email: string; phone: string
  password: string; confirmPassword: string
  address: string; city: string; state: string; zip: string
  alternatePhone: string; alternateEmail: string
  idPhotoUrl: string
}
interface ReserveResult {
  leaseId: string; clientSecret: string | null; devMode: boolean; totalAmount: number
}

const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard', climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up', vehicle_outdoor: 'Vehicle Storage',
}
const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ['Your Info', 'Payment', 'Sign Agreement', 'Welcome']
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((label, i) => {
        const n = i + 1; const done = step > n; const active = step === n
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${done ? 'bg-olive text-white' : active ? 'bg-brown text-cream' : 'bg-mid text-muted'}`}>
                {done ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> : n}
              </div>
              <span className={`mt-1 text-xs font-medium hidden sm:block ${active ? 'text-brown' : 'text-muted'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-10 sm:w-16 h-px mx-1 mb-5 ${step > n ? 'bg-olive' : 'bg-mid'}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Shared field ─────────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = 'text', required, hint }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brown mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded border border-mid px-3 py-2 text-sm text-brown bg-white focus:border-tan focus:outline-none focus:ring-1 focus:ring-tan/30 transition"
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

// ─── Form field config type ──────────────────────────────────────────────────

interface FieldConfig {
  key: string; label: string
  showOnSignup: boolean; requiredOnSignup: boolean
  showOnWaitingList: boolean; requiredOnWaitingList: boolean
  isCustom: boolean; order: number
}

function useFormFieldSettings() {
  const [fields, setFields] = useState<FieldConfig[]>([])
  useEffect(() => {
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.customerFormFields) setFields(json.data.customerFormFields)
      })
      .catch(() => {})
  }, [])
  const show = (key: string) => {
    const f = fields.find((ff) => ff.key === key)
    return !f || f.showOnSignup // default to show if not configured
  }
  const req = (key: string) => {
    const f = fields.find((ff) => ff.key === key)
    return f?.requiredOnSignup ?? false
  }
  return { fields, show, req }
}

// ─── Step 1: Account info ─────────────────────────────────────────────────────

function Step1Account({ form, setForm, unit, onDone }: {
  form: FormData; setForm: (f: FormData) => void; unit: Unit
  onDone: (result: ReserveResult) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState(false)
  const { show, req } = useFormFieldSettings()
  const set = (k: keyof FormData) => (v: string) => setForm({ ...form, [k]: v })

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
    } finally { setUploadingId(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/public/reserve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unit._id, firstName: form.firstName, lastName: form.lastName,
          email: form.email, phone: form.phone, password: form.password,
          address: form.address, city: form.city, state: form.state, zip: form.zip,
          alternatePhone: form.alternatePhone, alternateEmail: form.alternateEmail,
          idPhotoUrl: form.idPhotoUrl || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to create account')
      onDone(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-tan mb-3">Personal Information</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" value={form.firstName} onChange={set('firstName')} required />
          <Field label="Last Name" value={form.lastName} onChange={set('lastName')} required />
        </div>
      </div>
      <Field label="Email Address" value={form.email} onChange={set('email')} type="email" required />
      <Field label="Phone Number" value={form.phone} onChange={set('phone')} type="tel" required={req('cellPhone')}
        hint="Your gate code will default to the last 4 digits of this number" />

      {show('idPhoto') && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-tan mb-3 mt-2">
            Photo ID {req('idPhoto') && <span className="text-red-500 ml-0.5">*</span>}
          </p>
          <p className="text-xs text-muted mb-2">Upload a photo of your driver&apos;s license or government-issued ID</p>
          {form.idPhotoUrl ? (
            <div className="relative rounded-lg border border-mid overflow-hidden bg-white mb-1">
              <img src={form.idPhotoUrl} alt="ID Photo" className="w-full max-h-48 object-contain" />
              <button type="button" onClick={() => setForm({ ...form, idPhotoUrl: '' })}
                className="absolute top-2 right-2 text-xs text-red-600 bg-white/90 px-2 py-1 rounded hover:bg-red-50">
                Remove
              </button>
            </div>
          ) : (
            <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-mid rounded-lg cursor-pointer hover:border-tan transition-colors ${uploadingId ? 'opacity-50 pointer-events-none' : ''}`}>
              <svg className="w-8 h-8 text-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-muted">{uploadingId ? 'Uploading...' : 'Click to upload your ID'}</span>
              <span className="text-xs text-muted mt-1">JPG, PNG or WebP (max 10MB)</span>
              <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleIdUpload} />
            </label>
          )}
        </div>
      )}

      {(show('address') || show('city') || show('state') || show('zip')) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-tan mb-3 mt-2">Address</p>
          {show('address') && <Field label="Street Address" value={form.address} onChange={set('address')} required={req('address')} />}
          <div className="grid grid-cols-3 gap-3 mt-3">
            {show('city') && <div className="col-span-1"><Field label="City" value={form.city} onChange={set('city')} required={req('city')} /></div>}
            {show('state') && <Field label="State" value={form.state} onChange={set('state')} required={req('state')} />}
            {show('zip') && <Field label="ZIP" value={form.zip} onChange={set('zip')} required={req('zip')} />}
          </div>
        </div>
      )}

      {(show('alternateContact') || show('alternatePhone') || show('alternateEmail')) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-tan mb-3 mt-2">
            Alternate Contact {!req('alternateContact') && <span className="text-muted normal-case font-normal">(optional)</span>}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {show('alternatePhone') && <Field label="Alternate Phone" value={form.alternatePhone} onChange={set('alternatePhone')} type="tel" required={req('alternatePhone')} />}
            {show('alternateEmail') && <Field label="Alternate Email" value={form.alternateEmail} onChange={set('alternateEmail')} type="email" required={req('alternateEmail')} />}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-tan mb-3 mt-2">Create Password</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Password" value={form.password} onChange={set('password')} type="password" required hint="Min. 8 characters" />
          <Field label="Confirm Password" value={form.confirmPassword} onChange={set('confirmPassword')} type="password" required />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Link href={`/units/${unit._id}`} className="text-sm text-muted hover:text-brown transition-colors">← Back to unit</Link>
        <button type="submit" disabled={loading}
          className="rounded bg-tan px-6 py-2.5 text-sm font-semibold text-brown hover:bg-tan-light transition-colors disabled:opacity-50">
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

// ─── Step 2: Payment ──────────────────────────────────────────────────────────

function PaymentFormInner({ unit, leaseId, clientSecret, devMode, totalAmount, email, password, onDone }: {
  unit: Unit; leaseId: string; clientSecret: string | null; devMode: boolean
  totalAmount: number; email: string; password: string; onDone: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveCard, setSaveCard] = useState(true)

  async function handlePay(e: React.FormEvent) {
    e.preventDefault(); setPaying(true); setError(null)
    try {
      let paymentIntentId: string | undefined
      if (!devMode && clientSecret) {
        if (!stripe || !elements) throw new Error('Stripe not loaded')
        const card = elements.getElement(CardElement)
        if (!card) throw new Error('Card element not found')
        const { paymentIntent, error: stripeErr } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card },
        })
        if (stripeErr) throw new Error(stripeErr.message ?? 'Payment failed')
        if (paymentIntent?.status !== 'succeeded') throw new Error('Payment did not complete')
        paymentIntentId = paymentIntent.id
      }

      const res = await fetch('/api/public/reserve/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaseId, paymentIntentId, saveCard }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Confirmation failed')

      await signIn('credentials', { email, password, redirect: false })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setPaying(false)
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-5">
      <div className="rounded-lg bg-cream border border-mid p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Unit {unit.unitNumber} — {unit.size}</span>
          <span className="font-medium text-brown">{fmt(unit.price)}/mo</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">First month&apos;s rent</span>
          <span className="text-brown">{fmt(unit.price)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Security deposit</span>
          <span className="text-brown">{fmt(unit.price)}</span>
        </div>
        <div className="border-t border-mid pt-2 flex justify-between font-semibold">
          <span className="text-brown">Total due today</span>
          <span className="text-brown text-lg">{fmt(totalAmount)}</span>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {devMode ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <strong>Dev mode:</strong> Stripe is not configured. Click below to simulate a successful payment.
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-brown mb-2">Card Details</label>
          <div className="rounded border border-mid p-3 bg-white focus-within:border-tan transition-colors">
            <CardElement options={{ style: { base: { fontSize: '15px', color: '#1C0F06', '::placeholder': { color: '#9CA3AF' } }, invalid: { color: '#EF4444' } } }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">Test card: 4242 4242 4242 4242 · Any future date · Any CVC</p>
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer mb-4">
        <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-mid accent-brown" />
        <span className="text-sm text-brown/80 leading-snug">
          Save this card on file for future monthly payments
        </span>
      </label>

      <button type="submit" disabled={paying || (!devMode && !stripe)}
        className="w-full rounded bg-tan py-3 text-sm font-semibold text-brown hover:bg-tan-light transition-colors disabled:opacity-50">
        {paying ? 'Processing…' : `Pay ${fmt(totalAmount)} & Continue →`}
      </button>
    </form>
  )
}

function Step2Payment(props: Parameters<typeof PaymentFormInner>[0]) {
  return stripePromise ? (
    <Elements stripe={stripePromise}><PaymentFormInner {...props} /></Elements>
  ) : (
    <PaymentFormInner {...props} />
  )
}

// ─── Signature pad ────────────────────────────────────────────────────────────

function SignaturePad({ onChange }: { onChange: (data: string | null, type: 'drawn' | 'typed') => void }) {
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [typedName, setTypedName] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const src = 'touches' in e ? e.touches[0] : e
    return { x: (src.clientX - rect.left) * (canvas.width / rect.width), y: (src.clientY - rect.top) * (canvas.height / rect.height) }
  }

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current; if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    onChange(null, 'drawn')
  }, [onChange])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#1C0F06'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'

    const start = (e: MouseEvent | TouchEvent) => { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e, canvas) }
    const move = (e: MouseEvent | TouchEvent) => {
      e.preventDefault(); if (!drawing.current || !lastPos.current) return
      const pos = getPos(e, canvas)
      ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
      lastPos.current = pos
    }
    const end = () => { drawing.current = false; lastPos.current = null; onChange(canvas.toDataURL(), 'drawn') }

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move)
    canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseleave', end)
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false })
    canvas.addEventListener('touchend', end)
    return () => {
      canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move)
      canvas.removeEventListener('mouseup', end); canvas.removeEventListener('mouseleave', end)
      canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move)
      canvas.removeEventListener('touchend', end)
    }
  }, [onChange])

  useEffect(() => {
    if (mode !== 'type') return
    if (!typedName.trim()) { onChange(null, 'typed'); return }
    const canvas = document.createElement('canvas')
    canvas.width = 500; canvas.height = 120
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#1C0F06'; ctx.font = '56px "Dancing Script", cursive'
    ctx.textBaseline = 'middle'; ctx.fillText(typedName, 20, 64)
    onChange(canvas.toDataURL(), 'typed')
  }, [typedName, mode, onChange])

  return (
    <div>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" />
      <div className="flex gap-1 mb-3 bg-mid/30 rounded-lg p-1 w-fit">
        {(['draw', 'type'] as const).map((m) => (
          <button key={m} type="button"
            onClick={() => { setMode(m); onChange(null, m === 'draw' ? 'drawn' : 'typed'); clearCanvas() }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === m ? 'bg-white text-brown shadow-sm' : 'text-muted hover:text-brown'}`}>
            {m === 'draw' ? '✏️ Draw' : 'Aa Type'}
          </button>
        ))}
      </div>

      {mode === 'draw' ? (
        <div className="relative">
          <canvas ref={canvasRef} width={560} height={120}
            className="w-full border border-mid rounded-lg bg-white cursor-crosshair touch-none" style={{ height: '120px' }} />
          <button type="button" onClick={clearCanvas}
            className="absolute top-2 right-2 text-xs text-muted hover:text-brown px-2 py-1 bg-white/80 rounded">Clear</button>
          <p className="mt-1.5 text-xs text-muted text-center">Draw your signature above</p>
        </div>
      ) : (
        <div>
          <input type="text" value={typedName} onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your full name"
            className="w-full rounded border border-mid px-3 py-2 text-sm text-brown focus:border-tan focus:outline-none mb-3" />
          {typedName && (
            <div className="w-full border border-mid rounded-lg bg-white px-4 py-3"
              style={{ fontFamily: '"Dancing Script", cursive', fontSize: '2.5rem', color: '#1C0F06', minHeight: '80px', lineHeight: 1.2 }}>
              {typedName}
            </div>
          )}
          <p className="mt-1.5 text-xs text-muted">Your typed name will be used as your legal signature</p>
        </div>
      )}
    </div>
  )
}

// ─── Step 3: Agreement ────────────────────────────────────────────────────────

function Step3Agreement({ leaseId, tenantName, onDone }: {
  leaseId: string; tenantName: string; onDone: () => void
}) {
  const [html, setHtml] = useState('')
  const [title, setTitle] = useState('Storage Rental Agreement')
  const [loadingDoc, setLoadingDoc] = useState(true)
  const [docError, setDocError] = useState<string | null>(null)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [signatureType, setSignatureType] = useState<'drawn' | 'typed'>('drawn')
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  useEffect(() => {
    fetch(`/api/public/agreement/${leaseId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) { setHtml(json.data.html); setTitle(json.data.title) }
        else setDocError(json.error ?? 'Could not load agreement')
      })
      .catch(() => setDocError('Could not load agreement'))
      .finally(() => setLoadingDoc(false))
  }, [leaseId])

  const handleSigChange = useCallback((data: string | null, type: 'drawn' | 'typed') => {
    setSignatureData(data)
    setSignatureType(type)
    // Auto-scroll the agreement doc to the bottom so the user sees the signature appear
    if (data) {
      setTimeout(() => {
        const el = document.getElementById('agreement-scroll')
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      }, 100)
    }
  }, [])

  async function handleSign(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (!signatureData) { setError('Please provide your signature'); return }
    if (!agreed) { setError('Please confirm you agree to the terms'); return }
    setSigning(true)
    try {
      const res = await fetch(`/api/public/sign/${leaseId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData, signatureType }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to submit signature')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing failed')
      setSigning(false)
    }
  }

  return (
    <form onSubmit={handleSign}>
      {/* Document */}
      <div className="mb-6 border border-mid rounded-xl overflow-hidden">
        <div className="bg-brown px-4 py-2.5 flex items-center justify-between">
          <span className="text-cream text-sm font-semibold">{title}</span>
          <span className="text-cream/60 text-xs">Read before signing</span>
        </div>
        <div className="bg-gray-100 p-4" style={{ maxHeight: '420px', overflowY: 'auto' }} id="agreement-scroll">
          {loadingDoc ? (
            <div className="flex items-center justify-center py-16 text-muted text-sm">Loading agreement…</div>
          ) : docError ? (
            <div className="text-red-600 text-sm p-4 bg-red-50 rounded">{docError}</div>
          ) : (
            <div className="bg-white mx-auto shadow-sm rounded p-8"
              style={{ maxWidth: '720px', fontFamily: 'Georgia, serif', fontSize: '14px', lineHeight: 1.75, color: '#1C0F06' }}>
              <div dangerouslySetInnerHTML={{ __html: html }} />

              {/* Live signature block inside the document */}
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

      {/* Signature area */}
      <div className="border border-mid rounded-xl p-5 bg-cream mb-4">
        <h3 className="font-semibold text-brown mb-4">Sign Here</h3>
        <SignaturePad onChange={handleSigChange} />

        {signatureData && (
          <div className="mt-5 pt-4 border-t border-mid">
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <img src={signatureData} alt="Your signature" className="h-14 object-contain border-b border-brown/40 pb-1" />
                <p className="text-xs text-muted mt-1">Tenant Signature</p>
              </div>
              <div>
                <p className="text-sm font-medium text-brown border-b border-brown/40 pb-1" style={{ fontFamily: 'Georgia, serif' }}>{tenantName}</p>
                <p className="text-xs text-muted mt-1">Printed Name</p>
              </div>
              <div>
                <p className="text-sm text-brown border-b border-brown/40 pb-1">{today}</p>
                <p className="text-xs text-muted mt-1">Date</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer mb-4">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-mid accent-brown" />
        <span className="text-sm text-brown/80 leading-snug">
          I have read and agree to the Storage Rental Agreement. By clicking &quot;Sign &amp; Submit&quot; I am creating a legally binding signature.
        </span>
      </label>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}

      <button type="submit" disabled={signing || !signatureData || !agreed}
        className="w-full rounded bg-brown py-3 text-sm font-semibold text-cream hover:bg-brown/90 transition-colors disabled:opacity-50">
        {signing ? 'Submitting…' : 'Sign & Submit Agreement →'}
      </button>
    </form>
  )
}

// ─── Step 4: Welcome ──────────────────────────────────────────────────────────

function Step4Welcome({ unit, gateCode }: { unit: Unit; gateCode: string }) {
  const router = useRouter()
  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-20 h-20 bg-olive/10 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-10 h-10 text-olive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h2 className="font-serif text-3xl font-bold text-brown mb-2">Welcome to Tuscany Village!</h2>
        <p className="text-muted">Your unit is reserved and your agreement has been signed. You&apos;re all set.</p>
      </div>
      <div className="rounded-xl border border-mid bg-cream p-5 text-left space-y-2 max-w-sm mx-auto">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Unit</span>
          <span className="font-semibold text-brown">{unit.unitNumber} — {unit.size}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Type</span>
          <span className="text-brown">{TYPE_LABELS[unit.type] ?? unit.type}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Monthly Rent</span>
          <span className="text-brown">{fmt(unit.price)}/mo</span>
        </div>
      </div>
      <div className="rounded-xl border-2 border-tan bg-tan/5 p-6 max-w-sm mx-auto">
        <p className="text-sm font-semibold text-tan uppercase tracking-wide mb-2">Your Gate Code</p>
        <p className="font-serif text-5xl font-bold text-brown tracking-[0.3em]">{gateCode || '••••'}</p>
        <p className="mt-2 text-xs text-muted">Use this code at the gate keypad to access the facility</p>
      </div>
      <button onClick={() => router.push('/portal')}
        className="inline-block rounded bg-tan px-8 py-3 text-sm font-semibold text-brown hover:bg-tan-light transition-colors">
        Go to My Portal →
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReservePage() {
  const params = useParams()
  const unitId = params.unitId as string
  const { data: session, status: sessionStatus } = useSession()

  const [unit, setUnit] = useState<Unit | null>(null)
  const [loadingUnit, setLoadingUnit] = useState(true)
  const [unitError, setUnitError] = useState(false)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', confirmPassword: '',
    address: '', city: '', state: '', zip: '',
    alternatePhone: '', alternateEmail: '',
    idPhotoUrl: '',
  })
  const [reserveResult, setReserveResult] = useState<ReserveResult | null>(null)
  const [gateCode, setGateCode] = useState('')
  const [recoveredName, setRecoveredName] = useState('')

  // Load unit
  useEffect(() => {
    if (!unitId) return
    fetch(`/api/units/${unitId}`)
      .then((r) => r.json())
      .then((json) => { if (json.success && json.data) setUnit(json.data); else setUnitError(true) })
      .catch(() => setUnitError(true))
      .finally(() => setLoadingUnit(false))
  }, [unitId])

  // If user is already logged in, check for an unsigned lease → resume at step 3
  useEffect(() => {
    if (sessionStatus !== 'authenticated' || step !== 1) return
    fetch('/api/portal/active-lease')
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) return
        if (json.data.signedAt) {
          // Lease already signed — go to welcome
          setReserveResult({ leaseId: json.data.leaseId, clientSecret: null, devMode: true, totalAmount: 0 })
          setGateCode(json.data.gateCode)
          setStep(4)
        } else {
          // Payment done but not signed — resume signing
          setReserveResult({ leaseId: json.data.leaseId, clientSecret: null, devMode: true, totalAmount: 0 })
          setGateCode(json.data.gateCode)
          setRecoveredName(json.data.tenantName)
          setStep(3)
        }
      })
      .catch(() => {})
  }, [sessionStatus, step])

  if (loadingUnit) return <div className="min-h-[60vh] flex items-center justify-center"><p className="text-muted">Loading…</p></div>
  if (unitError || !unit) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="font-serif text-2xl text-brown mb-4">Unit not found</p>
      <Link href="/units" className="text-tan hover:underline">Browse all units</Link>
    </div>
  )
  if (unit.status !== 'available' && step === 1) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="font-serif text-2xl text-brown mb-2">This unit is no longer available</p>
      <p className="text-muted mb-6">Browse other available units or join the waiting list.</p>
      <Link href="/units" className="rounded bg-tan px-6 py-2.5 text-sm font-semibold text-brown hover:bg-tan-light">Browse Units</Link>
    </div>
  )

  const stepTitles = ['Create Your Account', 'Payment', 'Sign Your Agreement', '']

  return (
    <div className="min-h-screen bg-cream py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-tan mb-1">Reserve Your Unit</p>
          <h1 className="font-serif text-3xl font-bold text-brown">Unit {unit.unitNumber} — {unit.size}</h1>
          <p className="mt-1 text-muted text-sm">
            {TYPE_LABELS[unit.type] ?? unit.type} · {unit.sqft} sq ft · {fmt(unit.price)}/mo
          </p>
        </div>

        <StepIndicator step={step} />

        <div className="bg-white rounded-2xl border border-mid shadow-sm p-6 sm:p-8">
          {step < 4 && stepTitles[step - 1] && (
            <h2 className="font-serif text-xl font-bold text-brown mb-5">{stepTitles[step - 1]}</h2>
          )}

          {step === 1 && (
            <Step1Account form={form} setForm={setForm} unit={unit}
              onDone={(result) => {
                setReserveResult(result)
                setGateCode(form.phone.replace(/\D/g, '').slice(-4))
                setStep(2)
              }}
            />
          )}

          {step === 2 && reserveResult && (
            <Step2Payment
              unit={unit}
              leaseId={reserveResult.leaseId}
              clientSecret={reserveResult.clientSecret}
              devMode={reserveResult.devMode}
              totalAmount={reserveResult.totalAmount}
              email={form.email}
              password={form.password}
              onDone={() => setStep(3)}
            />
          )}

          {step === 3 && reserveResult && (
            <Step3Agreement
              leaseId={reserveResult.leaseId}
              tenantName={form.firstName ? `${form.firstName} ${form.lastName}` : recoveredName}
              onDone={() => setStep(4)}
            />
          )}

          {step === 4 && (
            <Step4Welcome unit={unit} gateCode={gateCode} />
          )}
        </div>
      </div>
    </div>
  )
}
