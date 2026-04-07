'use client'

import { useState, useCallback, DragEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
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
import { formatMoney, formatDate } from '@/lib/utils'

// ─── Placeholder upload function (Cloudflare R2 to be wired in later) ─────────

async function uploadPhoto(_file: File): Promise<string> {
  // TODO: replace with real Cloudflare R2 signed-upload flow
  await new Promise((resolve) => setTimeout(resolve, 400))
  return `https://storage.example.com/mock/${_file.name.replace(/\s+/g, '-')}`
}

// ─── Mock tenant/unit data ────────────────────────────────────────────────────
// TODO: fetch real data from GET /api/leases?status=active and GET /api/units/:id

const MOCK_UNIT = {
  unitNumber: 'B-14',
  size: '10×20',
  monthlyRate: 16500, // cents — $165.00
}

const MOCK_CARD = {
  last4: '4242',
  brand: 'Visa',
}

// ─── Move-out checklist guidelines ────────────────────────────────────────────

const GUIDELINES = [
  'I will remove all belongings by the move-out date',
  'I will clean the unit and return it in original condition',
  'I understand final month may be prorated',
  'I confirm there are no outstanding balances',
] as const

const STEPS = ['Confirm Your Information', 'Upload Unit Photos', 'Confirm Submission']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minMoveOutDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().split('T')[0]
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

interface Step1Props {
  moveOutDate: string
  cardConfirmed: boolean
  checkedGuidelines: Record<string, boolean>
  onDateChange: (v: string) => void
  onCardConfirmedChange: (v: boolean) => void
  onGuidelineChange: (label: string, v: boolean) => void
  onNext: () => void
}

function Step1({
  moveOutDate,
  cardConfirmed,
  checkedGuidelines,
  onDateChange,
  onCardConfirmedChange,
  onGuidelineChange,
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
            <Typography variant="subtitle1" fontWeight={600}>
              Your Current Unit
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Unit Number
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {MOCK_UNIT.unitNumber}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Size
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {MOCK_UNIT.size} ft
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Monthly Rate
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {formatMoney(MOCK_UNIT.monthlyRate)}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Move-out date */}
      <Card variant="outlined" sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CalendarMonthIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Requested Move-Out Date
            </Typography>
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
            <Typography variant="subtitle1" fontWeight={600}>
              Payment Method on File
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 2,
              bgcolor: '#FAF7F2',
              borderRadius: 1,
              border: '1px solid #EDE5D8',
              mb: 2,
            }}
          >
            <CreditCardIcon sx={{ color: 'text.secondary', fontSize: '1.25rem' }} />
            <Typography variant="body2" fontWeight={500}>
              {MOCK_CARD.brand} ••••{MOCK_CARD.last4}
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={cardConfirmed}
                onChange={(e) => onCardConfirmedChange(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">My payment information is up to date</Typography>
            }
          />
        </CardContent>
      </Card>

      {/* Guidelines checklist */}
      <Card variant="outlined" sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
            Move-Out Guidelines
          </Typography>
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

  const canProceed = files.length >= 1

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Alert severity="info" sx={{ borderRadius: 1 }}>
        Please take at least 2 photos of your empty unit — front, back, and any corners with
        damage. Photos will be uploaded when you submit the form.
      </Alert>

      {/* Drag-zone */}
      <Box
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
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

      {/* Thumbnails */}
      {files.length > 0 && (
        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            Selected Photos ({files.length})
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 1.5,
            }}
          >
            {files.map((file, index) => (
              <Box
                key={`${file.name}-${index}`}
                sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden' }}
              >
                <Box
                  component="img"
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  sx={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    display: 'block',
                    border: '1px solid #EDE5D8',
                    borderRadius: 1,
                  }}
                />
                <Box
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(index)
                  }}
                  role="button"
                  aria-label={`Remove ${file.name}`}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    bgcolor: 'rgba(28,15,6,0.7)',
                    color: 'white',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    lineHeight: 1,
                    '&:hover': { bgcolor: 'rgba(28,15,6,0.9)' },
                  }}
                >
                  ✕
                </Box>
                <Typography
                  variant="caption"
                  display="block"
                  sx={{
                    mt: 0.5,
                    fontSize: '0.7rem',
                    color: 'text.secondary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {file.name}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {!canProceed && (
        <Typography variant="caption" color="error">
          At least 1 photo is required to continue.
        </Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="text" onClick={onBack} sx={{ color: 'text.secondary' }}>
          Back
        </Button>
        <Button variant="contained" disabled={!canProceed} onClick={onNext} size="large">
          Continue
        </Button>
      </Box>
    </Box>
  )
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

interface Step3Props {
  moveOutDate: string
  cardConfirmed: boolean
  photoCount: number
  submitting: boolean
  onBack: () => void
  onSubmit: () => void
}

function Step3({ moveOutDate, cardConfirmed, photoCount, submitting, onBack, onSubmit }: Step3Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="body2" color="text.secondary">
        Please review your submission details below before confirming.
      </Typography>

      <Card variant="outlined" sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Submission Summary
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Unit
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {MOCK_UNIT.unitNumber} ({MOCK_UNIT.size} ft)
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Requested Move-Out Date
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {moveOutDate ? formatDate(moveOutDate) : '—'}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Payment Info Confirmed
              </Typography>
              <Chip
                label={cardConfirmed ? 'Yes' : 'No'}
                size="small"
                sx={{
                  bgcolor: cardConfirmed ? '#D1FAE5' : '#FEE2E2',
                  color: cardConfirmed ? '#065F46' : '#991B1B',
                  fontWeight: 600,
                }}
              />
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Photos Attached
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Alert severity="warning" sx={{ borderRadius: 1 }}>
        Once submitted, the admin will review your request and respond within 24 hours.
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="text" onClick={onBack} disabled={submitting} sx={{ color: 'text.secondary' }}>
          Back
        </Button>
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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        py: 6,
        px: 3,
        gap: 2,
      }}
    >
      <CheckCircleIcon sx={{ fontSize: 72, color: '#16A34A' }} />
      <Typography
        variant="h5"
        sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', fontWeight: 700 }}
      >
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

  // Step 1 state
  const [moveOutDate, setMoveOutDate] = useState('')
  const [cardConfirmed, setCardConfirmed] = useState(false)
  const [checkedGuidelines, setCheckedGuidelines] = useState<Record<string, boolean>>(
    Object.fromEntries(GUIDELINES.map((g) => [g, false])),
  )

  // Step 2 state
  const [files, setFiles] = useState<File[]>([])

  const handleGuidelineChange = (label: string, value: boolean) => {
    setCheckedGuidelines((prev) => ({ ...prev, [label]: value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      // Upload photos using placeholder function, then collect mock URLs
      // TODO: replace uploadPhoto() with real Cloudflare R2 signed upload
      const photoUrls = await Promise.all(files.map((file) => uploadPhoto(file)))

      const res = await fetch('/api/move-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedMoveOutDate: new Date(moveOutDate).toISOString(),
          stripePaymentMethodConfirmed: cardConfirmed,
          lastFourDigits: MOCK_CARD.last4,
          photoUrls,
          guidelinesAccepted: true,
        }),
      })

      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error ?? 'Failed to submit move-out request.')
      }

      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Box>
        <Typography
          variant="h5"
          sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 3 }}
        >
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
      <Typography
        variant="h5"
        sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 1 }}
      >
        Move Out
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Complete the steps below to submit your move-out request.
      </Typography>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {activeStep === 0 && (
        <Step1
          moveOutDate={moveOutDate}
          cardConfirmed={cardConfirmed}
          checkedGuidelines={checkedGuidelines}
          onDateChange={setMoveOutDate}
          onCardConfirmedChange={setCardConfirmed}
          onGuidelineChange={handleGuidelineChange}
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
          moveOutDate={moveOutDate}
          cardConfirmed={cardConfirmed}
          photoCount={files.length}
          submitting={submitting}
          onBack={() => setActiveStep(1)}
          onSubmit={handleSubmit}
        />
      )}
    </Box>
  )
}
