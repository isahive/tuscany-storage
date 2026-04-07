'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import type { SelectChangeEvent } from '@mui/material'
import type { UnitType, UnitFloor } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIT_TYPES: { value: UnitType; label: string }[] = [
  { value: 'standard',           label: 'Standard' },
  { value: 'climate_controlled', label: 'Climate Controlled' },
  { value: 'drive_up',           label: 'Drive-Up' },
  { value: 'vehicle_outdoor',    label: 'Vehicle / Outdoor' },
]

const UNIT_FLOORS: { value: UnitFloor; label: string }[] = [
  { value: 'ground', label: 'Ground Floor' },
  { value: 'upper',  label: 'Upper Floor' },
]

const ALL_FEATURES = [
  'Climate controlled',
  'Drive-up access',
  'Ground floor',
  'LED lighting',
  'Wide door',
  'Extra height',
  '24/7 access',
  'Covered parking',
] as const

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  unitNumber: string
  type: UnitType
  floor: UnitFloor
  width: string
  depth: string
  priceDollars: string
  features: string[]
  notes: string
}

interface FormErrors {
  unitNumber?: string
  width?: string
  depth?: string
  priceDollars?: string
}

const INITIAL_FORM: FormState = {
  unitNumber:   '',
  type:         'standard',
  floor:        'ground',
  width:        '',
  depth:        '',
  priceDollars: '',
  features:     [],
  notes:        '',
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.unitNumber.trim()) errors.unitNumber = 'Unit number is required'
  if (!form.width || isNaN(Number(form.width)) || Number(form.width) <= 0)
    errors.width = 'Enter a valid width'
  if (!form.depth || isNaN(Number(form.depth)) || Number(form.depth) <= 0)
    errors.depth = 'Enter a valid depth'
  if (!form.priceDollars || isNaN(Number(form.priceDollars)) || Number(form.priceDollars) < 0)
    errors.priceDollars = 'Enter a valid price'
  return errors
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewUnitPage() {
  const router = useRouter()

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  // Derived size string
  const sizePreview = useMemo(() => {
    const w = Number(form.width)
    const d = Number(form.depth)
    if (w > 0 && d > 0) return `${w}x${d}`
    return '—'
  }, [form.width, form.depth])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleTextField(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }
  }

  function handleSelect(field: 'type' | 'floor') {
    return (e: SelectChangeEvent) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }
  }

  function toggleFeature(feature: string) {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const validationErrors = validate(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    const width = Number(form.width)
    const depth = Number(form.depth)

    const payload = {
      unitNumber: form.unitNumber.trim(),
      type:       form.type,
      floor:      form.floor,
      width,
      depth,
      size:       `${width}x${depth}`,
      price:      Math.round(Number(form.priceDollars) * 100),
      features:   form.features,
      notes:      form.notes.trim() || undefined,
      sqft:       width * depth,
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/units', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Request failed (${res.status})`)
      }

      setSuccessOpen(true)
      // Brief delay so the snackbar is visible before navigating
      setTimeout(() => router.push('/admin/units'), 1200)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/admin/units')}
          sx={{ color: 'text.secondary' }}
        >
          Units
        </Button>
        <Divider orientation="vertical" flexItem />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Add New Unit
        </Typography>
      </Box>

      {/* Error banner */}
      {submitError && (
        <Alert severity="error" onClose={() => setSubmitError(null)} sx={{ mb: 3 }}>
          {submitError}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* ── Identity & Dimensions ─────────────────────────────────────── */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title="Unit Details"
              titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
              sx={{ pb: 0 }}
            />
            <CardContent>
              <Grid container spacing={2.5}>
                {/* Unit Number */}
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Unit Number"
                    placeholder="e.g. 14B"
                    value={form.unitNumber}
                    onChange={handleTextField('unitNumber')}
                    error={!!errors.unitNumber}
                    helperText={errors.unitNumber}
                    required
                    fullWidth
                    inputProps={{ maxLength: 10 }}
                  />
                </Grid>

                {/* Type */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      label="Type"
                      value={form.type}
                      onChange={handleSelect('type')}
                    >
                      {UNIT_TYPES.map((t) => (
                        <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Floor */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Floor</InputLabel>
                    <Select
                      label="Floor"
                      value={form.floor}
                      onChange={handleSelect('floor')}
                    >
                      {UNIT_FLOORS.map((f) => (
                        <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Width */}
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Width"
                    type="number"
                    value={form.width}
                    onChange={handleTextField('width')}
                    error={!!errors.width}
                    helperText={errors.width}
                    fullWidth
                    inputProps={{ min: 1, step: 1 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">ft</InputAdornment>,
                    }}
                  />
                </Grid>

                {/* Depth */}
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Depth"
                    type="number"
                    value={form.depth}
                    onChange={handleTextField('depth')}
                    error={!!errors.depth}
                    helperText={errors.depth}
                    fullWidth
                    inputProps={{ min: 1, step: 1 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">ft</InputAdornment>,
                    }}
                  />
                </Grid>

                {/* Size (auto-calculated) */}
                <Grid item xs={12} sm={4}>
                  <Box
                    sx={{
                      border: '1px solid #EDE5D8',
                      borderRadius: 1,
                      px: 2,
                      py: 1.75,
                      bgcolor: '#FAF7F2',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1 }}>
                      Calculated Size
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.25 }}>
                      {sizePreview}
                    </Typography>
                    {Number(form.width) > 0 && Number(form.depth) > 0 && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {Number(form.width) * Number(form.depth)} sq ft
                      </Typography>
                    )}
                  </Box>
                </Grid>

                {/* Monthly Price */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth error={!!errors.priceDollars}>
                    <InputLabel htmlFor="price-input">Monthly Price</InputLabel>
                    <OutlinedInput
                      id="price-input"
                      type="number"
                      label="Monthly Price"
                      value={form.priceDollars}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, priceDollars: e.target.value }))
                        if (errors.priceDollars) setErrors((prev) => ({ ...prev, priceDollars: undefined }))
                      }}
                      startAdornment={<InputAdornment position="start">$</InputAdornment>}
                      inputProps={{ min: 0, step: '0.01' }}
                    />
                    {errors.priceDollars && (
                      <FormHelperText>{errors.priceDollars}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>

                {/* Notes */}
                <Grid item xs={12}>
                  <TextField
                    label="Notes"
                    placeholder="Optional internal notes about this unit..."
                    value={form.notes}
                    onChange={handleTextField('notes')}
                    fullWidth
                    multiline
                    minRows={3}
                    inputProps={{ maxLength: 500 }}
                    helperText={`${form.notes.length}/500`}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Features ──────────────────────────────────────────────────── */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Features"
              titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
              subheader="Select all that apply"
              subheaderTypographyProps={{ variant: 'caption' }}
              sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {ALL_FEATURES.map((feature) => {
                  const selected = form.features.includes(feature)
                  return (
                    <Chip
                      key={feature}
                      label={feature}
                      clickable
                      onClick={() => toggleFeature(feature)}
                      variant={selected ? 'filled' : 'outlined'}
                      sx={{
                        borderRadius: 1,
                        fontWeight: selected ? 600 : 400,
                        bgcolor: selected ? 'primary.main' : 'transparent',
                        color: selected ? 'secondary.main' : 'text.primary',
                        borderColor: selected ? 'primary.main' : '#EDE5D8',
                        '&:hover': {
                          bgcolor: selected ? 'primary.dark' : 'rgba(184,145,74,0.08)',
                        },
                      }}
                    />
                  )
                })}
              </Box>

              {form.features.length > 0 && (
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block', mt: 2 }}
                >
                  {form.features.length} feature{form.features.length !== 1 ? 's' : ''} selected
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => router.push('/admin/units')}
              disabled={submitting}
              sx={{ borderColor: '#EDE5D8', color: 'text.secondary' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
              disabled={submitting}
              sx={{ minWidth: 140 }}
            >
              {submitting ? 'Creating…' : 'Create Unit'}
            </Button>
          </Box>
        </Grid>
      </Grid>

      {/* Success snackbar */}
      <Snackbar
        open={successOpen}
        autoHideDuration={3000}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          onClose={() => setSuccessOpen(false)}
          variant="filled"
          sx={{ width: '100%' }}
        >
          Unit created successfully
        </Alert>
      </Snackbar>
    </Box>
  )
}
