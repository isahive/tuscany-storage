'use client'

import { useState, useCallback, useEffect, DragEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Divider,
  FormControlLabel,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import StorageIcon from '@mui/icons-material/Storage'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { formatMoney, formatDate } from '@/lib/utils'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PaymentMethod {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

// ─── Upload (R2 placeholder) ───────────────────────────────────────────────────

async function uploadPhoto(_file: File): Promise<string> {
  // TODO: replace with real Cloudflare R2 signed-upload flow
  await new Promise((resolve) => setTimeout(resolve, 400))
  return `https://storage.example.com/mock/${_file.name.replace(/\s+/g, '-')}`
}

// ─── Unit data type ──────────────────────────────────────────────────────────

interface UnitInfo {
  unitNumber: string
  size: string
  monthlyRate: number
}

// ─── Move-out guidelines ──────────────────────────────────────────────────────

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

// ─── Stripe update card form ───────────────────────────────────────────────────

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
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{error}</Alert>}
      <Box
        sx={{
          border: '1px solid #EDE5D8',
          borderRadius: 1.5,
          p: 1.5,
          mb: 2,
          '&:focus-within': { borderColor: '#B8914A' },
          transition: 'border-color 0.15s',
        }}
      >
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1C0F06',
                fontFamily: '"DM Sans", sans-serif',
                '::placeholder': { color: '#9CA3AF' },
              },
              invalid: { color: '#EF4444' },
            },
          }}
        />
      </Box>
      <DialogActions sx={{ px: 0, pb: 0 }}>
        <Button onClick={onCancel} sx={{ color: 'text.secondary', textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !stripe}
          startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : undefined}
          sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}
        >
          {saving ? 'Saving…' : 'Save Card'}
        </Button>
      </DialogActions>
    </Box>
  )
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

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
  unit,
  moveOutDate,
  cardConfirmed,
  checkedGuidelines,
  paymentMethod,
  loadingPayment,
  onDateChange,
  onCardConfirmedChange,
  onGuidelineChange,
  onUpdateCard,
  onNext,
}: Step1Props) {
  const allGuidelinesChecked = GUIDELINES.every((g) => checkedGuidelines[g])
  const canProceed = moveOutDate !== '' && cardConfirmed && allGuidelinesChecked

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Unit info */}
      <Card variant="outlined" sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <StorageIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>Your Current Unit</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Unit Number</Typography>
              <Typography variant="body1" fontWeight={600}>{unit.unitNumber}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Size</Typography>
              <Typography variant="body1" fontWeight={600}>{unit.size} ft</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Monthly Rate</Typography>
              <Typography variant="body1" fontWeight={600}>{formatMoney(unit.monthlyRate)}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Move-out date */}
      <Card variant="outlined" sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CalendarMonthIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>Requested Move-Out Date</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Please give at least 30 days&apos; notice. Earliest available:{' '}
            <strong>{formatDate(minMoveOutDate())}</strong>.
          </Typography>
          <input
            type="date"
            min={minMoveOutDate()}
            value={moveOutDate}
            onChange={(e) => onDateChange(e.target.value)}
            aria-label="Requested move-out date"
            style={{
              padding: '10px 14px',
              border: '1px solid #EDE5D8',
              borderRadius: 4,
              fontFamily: '"DM Sans", Arial, sans-serif',
              fontSize: '0.9375rem',
              color: '#1C0F06',
              background: '#FFFFFF',
              cursor: 'pointer',
              outline: 'none',
            }}
          />
        </CardContent>
      </Card>

      {/* Payment method */}
      <Card variant="outlined" sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CreditCardIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>Payment Method on File</Typography>
          </Box>

          {loadingPayment ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CircularProgress size={16} sx={{ color: '#B8914A' }} />
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            </Box>
          ) : paymentMethod ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                p: 2,
                bgcolor: '#FAF7F2',
                borderRadius: 1,
                border: '1px solid #EDE5D8',
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CreditCardIcon sx={{ color: 'text.secondary', fontSize: '1.25rem' }} />
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {brandLabel(paymentMethod.brand)} •••• {paymentMethod.last4}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
                  </Typography>
                </Box>
              </Box>
              <Button
                startIcon={<EditIcon fontSize="small" />}
                onClick={onUpdateCard}
                sx={{
                  textTransform: 'none',
                  color: '#B8914A',
                  fontWeight: 500,
                  minHeight: 44,
                  '&:hover': { bgcolor: 'rgba(184,145,74,0.08)' },
                  whiteSpace: 'nowrap',
                }}
              >
                Update
              </Button>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                p: 2,
                bgcolor: '#FEF3C7',
                borderRadius: 1,
                border: '1px solid #FDE68A',
                mb: 2,
              }}
            >
              <Typography variant="body2" sx={{ color: '#92400E' }}>
                No payment method on file. Please add a card to continue.
              </Typography>
              <Button
                startIcon={<AddIcon fontSize="small" />}
                onClick={onUpdateCard}
                sx={{
                  textTransform: 'none',
                  bgcolor: '#B8914A',
                  color: 'white',
                  fontWeight: 600,
                  minHeight: 44,
                  '&:hover': { bgcolor: '#9A7A3E' },
                  whiteSpace: 'nowrap',
                }}
                variant="contained"
              >
                Add Card
              </Button>
            </Box>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={cardConfirmed}
                onChange={(e) => onCardConfirmedChange(e.target.checked)}
                disabled={!paymentMethod}
                color="primary"
              />
            }
            label={<Typography variant="body2">My payment information is up to date</Typography>}
          />
        </CardContent>
      </Card>

      {/* Guidelines checklist */}
      <Card variant="outlined" sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>Move-Out Guidelines</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please confirm each item before continuing.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {GUIDELINES.map((guideline) => (
              <FormControlLabel
                key={guideline}
                control={
                  <Checkbox
                    checked={checkedGuidelines[guideline] ?? false}
                    onChange={(e) => onGuidelineChange(guideline, e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography variant="body2">{guideline}</Typography>}
                sx={{ alignItems: 'flex-start', '& .MuiCheckbox-root': { pt: 0.25 } }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" disabled={!canProceed} onClick={onNext} size="large">
          Continue
        </Button>
      </Box>
    </Box>
  )
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

interface Step2Props {
  files: File[]
  onFilesChange: (files: File[]) => void
  onNext: () => void
  onBack: () => void
}

function Step2({ files, onFilesChange, onNext, onBack }: Step2Props) {
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Alert severity="info" sx={{ borderRadius: 1 }}>
        Please take at least 2 photos of your empty unit — front, back, and any corners with
        damage. Photos will be uploaded when you submit the form.
      </Alert>

      <Box
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        sx={{
          border: `2px dashed ${dragOver ? '#B8914A' : '#EDE5D8'}`,
          borderRadius: 2,
          p: 5,
          textAlign: 'center',
          bgcolor: dragOver ? 'rgba(184,145,74,0.06)' : '#FAF7F2',
          transition: 'border-color 0.15s, background-color 0.15s',
          cursor: 'pointer',
        }}
        onClick={() => document.getElementById('photo-upload-input')?.click()}
        role="button"
        aria-label="Upload photos"
      >
        <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="body1" fontWeight={500} color="secondary.main">
          Drag &amp; drop photos here, or click to browse
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          Accepts JPG, PNG, HEIC — multiple files allowed
        </Typography>
        <input
          id="photo-upload-input"
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </Box>

      {files.length > 0 && (
        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            Selected Photos ({files.length})
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 1.5 }}>
            {files.map((file, index) => (
              <Box key={`${file.name}-${index}`} sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden' }}>
                <Box
                  component="img"
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', border: '1px solid #EDE5D8', borderRadius: 1 }}
                />
                <Box
                  onClick={(e) => { e.stopPropagation(); handleRemove(index) }}
                  role="button"
                  aria-label={`Remove ${file.name}`}
                  sx={{
                    position: 'absolute', top: 4, right: 4,
                    bgcolor: 'rgba(28,15,6,0.7)', color: 'white',
                    borderRadius: '50%', width: 22, height: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', cursor: 'pointer', lineHeight: 1,
                    '&:hover': { bgcolor: 'rgba(28,15,6,0.9)' },
                  }}
                >
                  ✕
                </Box>
                <Typography variant="caption" display="block" sx={{ mt: 0.5, fontSize: '0.7rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {files.length < 1 && (
        <Typography variant="caption" color="error">At least 1 photo is required to continue.</Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="text" onClick={onBack} sx={{ color: 'text.secondary' }}>Back</Button>
        <Button variant="contained" disabled={files.length < 1} onClick={onNext} size="large">Continue</Button>
      </Box>
    </Box>
  )
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

interface Step3Props {
  unit: UnitInfo
  moveOutDate: string
  cardConfirmed: boolean
  paymentMethod: PaymentMethod | null
  photoCount: number
  submitting: boolean
  onBack: () => void
  onSubmit: () => void
}

function Step3({ unit, moveOutDate, cardConfirmed, paymentMethod, photoCount, submitting, onBack, onSubmit }: Step3Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="body2" color="text.secondary">
        Please review your submission details before confirming.
      </Typography>

      <Card variant="outlined" sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Submission Summary</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">Unit</Typography>
              <Typography variant="body2" fontWeight={500}>{unit.unitNumber} ({unit.size} ft)</Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">Requested Move-Out Date</Typography>
              <Typography variant="body2" fontWeight={500}>{moveOutDate ? formatDate(moveOutDate) : '—'}</Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">Payment Method</Typography>
              <Typography variant="body2" fontWeight={500}>
                {paymentMethod
                  ? `${brandLabel(paymentMethod.brand)} •••• ${paymentMethod.last4}`
                  : '—'}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">Payment Info Confirmed</Typography>
              <Chip
                label={cardConfirmed ? 'Yes' : 'No'}
                size="small"
                sx={{ bgcolor: cardConfirmed ? '#D1FAE5' : '#FEE2E2', color: cardConfirmed ? '#065F46' : '#991B1B', fontWeight: 600 }}
              />
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">Photos Attached</Typography>
              <Typography variant="body2" fontWeight={500}>{photoCount} {photoCount === 1 ? 'photo' : 'photos'}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Alert severity="warning" sx={{ borderRadius: 1 }}>
        Once submitted, the admin will review your request and respond within 24 hours.
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="text" onClick={onBack} disabled={submitting} sx={{ color: 'text.secondary' }}>Back</Button>
        <Button
          variant="contained"
          size="large"
          onClick={onSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {submitting ? 'Submitting…' : 'Submit Request'}
        </Button>
      </Box>
    </Box>
  )
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 6, px: 3, gap: 2 }}>
      <CheckCircleIcon sx={{ fontSize: 72, color: '#16A34A' }} />
      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', fontWeight: 700 }}>
        Request Submitted
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420 }}>
        Your move-out request has been submitted. The admin will review it and respond within
        24 hours. You will receive a confirmation email once a decision has been made.
      </Typography>
    </Box>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MoveOutPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Unit data state
  const [unit, setUnit] = useState<UnitInfo | null>(null)
  const [loadingUnit, setLoadingUnit] = useState(true)

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [loadingPayment, setLoadingPayment] = useState(true)
  const [cardDialogOpen, setCardDialogOpen] = useState(false)

  // Step 1 state
  const [moveOutDate, setMoveOutDate] = useState('')
  const [cardConfirmed, setCardConfirmed] = useState(false)
  const [checkedGuidelines, setCheckedGuidelines] = useState<Record<string, boolean>>(
    Object.fromEntries(GUIDELINES.map((g) => [g, false])),
  )

  // Step 2 state
  const [files, setFiles] = useState<File[]>([])

  // Load unit data on mount
  useEffect(() => {
    fetch('/api/portal/dashboard')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data?.unit) {
          const u = j.data.unit
          setUnit({
            unitNumber: u.unitNumber,
            size: u.size,
            monthlyRate: u.monthlyRate,
          })
        }
      })
      .catch(() => {/* keep null */})
      .finally(() => setLoadingUnit(false))
  }, [])

  // Load real payment method on mount
  useEffect(() => {
    fetch('/api/portal/billing-info')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setPaymentMethod(j.data.paymentMethod ?? null)
      })
      .catch(() => {/* keep null */})
      .finally(() => setLoadingPayment(false))
  }, [])

  function handleCardSuccess() {
    setCardDialogOpen(false)
    setLoadingPayment(true)
    // Reload card details after update
    fetch('/api/portal/billing-info')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setPaymentMethod(j.data.paymentMethod ?? null)
      })
      .catch(() => {})
      .finally(() => setLoadingPayment(false))
  }

  const handleGuidelineChange = (label: string, value: boolean) => {
    setCheckedGuidelines((prev) => ({ ...prev, [label]: value }))
  }

  const handleSubmit = async () => {
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  if (!unit) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 3 }}>
          Move Out
        </Typography>
        <Alert severity="error">Unable to load unit information. Please try again later.</Alert>
      </Box>
    )
  }

  if (done) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 3 }}>
          Move Out
        </Typography>
        <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
          <CardContent sx={{ p: 0 }}>
            <SuccessScreen />
          </CardContent>
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 1 }}>
        Move Out
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Complete the steps below to submit your move-out request.
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
        {STEPS.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
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

      {/* Update / Add card dialog */}
      <Dialog open={cardDialogOpen} onClose={() => setCardDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06' }}>
          {paymentMethod ? 'Update Payment Method' : 'Add Payment Method'}
        </DialogTitle>
        <DialogContent>
          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <UpdateCardForm
                onSuccess={handleCardSuccess}
                onCancel={() => setCardDialogOpen(false)}
              />
            </Elements>
          ) : (
            <Alert severity="warning">
              Online card updates are not available in this environment. Please contact the facility.
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
