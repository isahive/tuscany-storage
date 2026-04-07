'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import type { SelectChangeEvent } from '@mui/material'
import type { Unit, UnitType, UnitFloor } from '@/types'

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

function unitToForm(unit: Unit): FormState {
  return {
    unitNumber:   unit.unitNumber,
    type:         unit.type,
    floor:        unit.floor,
    width:        String(unit.width),
    depth:        String(unit.depth),
    priceDollars: String(unit.price / 100),
    features:     unit.features ?? [],
    notes:        unit.notes ?? '',
  }
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

// ── Build patch payload (only changed fields) ─────────────────────────────────

function buildPatch(original: Unit, form: FormState): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const width  = Number(form.width)
  const depth  = Number(form.depth)
  const price  = Math.round(Number(form.priceDollars) * 100)

  if (form.unitNumber.trim() !== original.unitNumber)  patch.unitNumber = form.unitNumber.trim()
  if (form.type  !== original.type)                    patch.type       = form.type
  if (form.floor !== original.floor)                   patch.floor      = form.floor
  if (width !== original.width)                        patch.width      = width
  if (depth !== original.depth)                        patch.depth      = depth
  if (price !== original.price)                        patch.price      = price

  // size / sqft follow width / depth
  if (width !== original.width || depth !== original.depth) {
    patch.size = `${width}x${depth}`
    patch.sqft = width * depth
  }

  // Features: compare sorted arrays
  const origFeatures = [...(original.features ?? [])].sort().join('|')
  const newFeatures  = [...form.features].sort().join('|')
  if (newFeatures !== origFeatures) patch.features = form.features

  const newNotes = form.notes.trim() || undefined
  if (newNotes !== (original.notes ?? undefined)) patch.notes = newNotes ?? null

  return patch
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function FormSkeleton() {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Grid container spacing={2.5}>
              {Array.from({ length: 7 }).map((_, i) => (
                <Grid item xs={12} sm={i < 3 ? 4 : i === 6 ? 12 : 6} key={i}>
                  <Skeleton variant="rounded" height={56} />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" width={110} height={32} />
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditUnitPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const unitId = params.id

  const [unit, setUnit]           = useState<Unit | null>(null)
  const [form, setForm]           = useState<FormState | null>(null)
  const [loading, setLoading]     = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [errors, setErrors]         = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting]                 = useState(false)
  const [deleteError, setDeleteError]           = useState<string | null>(null)

  // ── Fetch unit ──────────────────────────────────────────────────────────

  const fetchUnit = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res  = await fetch(`/api/units/${unitId}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Failed to load unit (${res.status})`)
      }
      setUnit(json.data)
      setForm(unitToForm(json.data))
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load unit')
    } finally {
      setLoading(false)
    }
  }, [unitId])

  useEffect(() => {
    fetchUnit()
  }, [fetchUnit])

  // ── Derived ─────────────────────────────────────────────────────────────

  const sizePreview = useMemo(() => {
    if (!form) return '—'
    const w = Number(form.width)
    const d = Number(form.depth)
    if (w > 0 && d > 0) return `${w}x${d}`
    return '—'
  }, [form])

  const hasChanges = useMemo(() => {
    if (!unit || !form) return false
    return Object.keys(buildPatch(unit, form)).length > 0
  }, [unit, form])

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleTextField(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => prev ? { ...prev, [field]: e.target.value } : prev)
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }
  }

  function handleSelect(field: 'type' | 'floor') {
    return (e: SelectChangeEvent) => {
      setForm((prev) => prev ? { ...prev, [field]: e.target.value } : prev)
    }
  }

  function toggleFeature(feature: string) {
    setForm((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        features: prev.features.includes(feature)
          ? prev.features.filter((f) => f !== feature)
          : [...prev.features, feature],
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unit || !form) return
    setSubmitError(null)

    const validationErrors = validate(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    const patch = buildPatch(unit, form)
    if (Object.keys(patch).length === 0) {
      // Nothing changed — treat as success and navigate back
      router.push('/admin/units')
      return
    }

    setSubmitting(true)
    try {
      const res  = await fetch(`/api/units/${unitId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(patch),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Request failed (${res.status})`)
      }

      setSuccessOpen(true)
      setTimeout(() => router.push('/admin/units'), 1200)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setDeleteError(null)
    setDeleting(true)
    try {
      const res  = await fetch(`/api/units/${unitId}`, { method: 'DELETE' })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Delete failed (${res.status})`)
      }

      setDeleteDialogOpen(false)
      router.push('/admin/units')
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete unit')
    } finally {
      setDeleting(false)
    }
  }

  // ── Render: fetch error ──────────────────────────────────────────────────

  if (!loading && fetchError) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/admin/units')}
          sx={{ color: 'text.secondary', mb: 2 }}
        >
          Units
        </Button>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchUnit}>
              Retry
            </Button>
          }
        >
          {fetchError}
        </Alert>
      </Box>
    )
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
          {loading ? <Skeleton width={200} /> : `Edit Unit ${unit?.unitNumber ?? ''}`}
        </Typography>

        {/* Delete button — only for available units */}
        {!loading && unit?.status === 'available' && (
          <Box sx={{ ml: 'auto' }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{ borderColor: 'error.main' }}
            >
              Delete Unit
            </Button>
          </Box>
        )}
      </Box>

      {/* Submit error banner */}
      {submitError && (
        <Alert severity="error" onClose={() => setSubmitError(null)} sx={{ mb: 3 }}>
          {submitError}
        </Alert>
      )}

      {loading ? (
        <FormSkeleton />
      ) : form ? (
        <Grid container spacing={3}>
          {/* ── Identity & Dimensions ───────────────────────────────────── */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardHeader
                title="Unit Details"
                titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
                subheader={
                  unit
                    ? `Status: ${unit.status.charAt(0).toUpperCase() + unit.status.slice(1).replace('_', ' ')}`
                    : undefined
                }
                subheaderTypographyProps={{ variant: 'caption' }}
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
                          setForm((prev) => prev ? { ...prev, priceDollars: e.target.value } : prev)
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

          {/* ── Features ────────────────────────────────────────────────── */}
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

          {/* ── Submit ──────────────────────────────────────────────────── */}
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
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                disabled={submitting || !hasChanges}
                sx={{ minWidth: 140 }}
              >
                {submitting ? 'Saving…' : 'Save Changes'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      ) : null}

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
          Unit updated successfully
        </Alert>
      </Snackbar>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Delete Unit {unit?.unitNumber}?
        </DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteError(null)}>
              {deleteError}
            </Alert>
          )}
          <DialogContentText>
            This will permanently remove unit{' '}
            <strong>{unit?.unitNumber}</strong> from the system. This action cannot
            be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
            sx={{ borderColor: '#EDE5D8', color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={
              deleting
                ? <CircularProgress size={16} color="inherit" />
                : <DeleteOutlineIcon />
            }
          >
            {deleting ? 'Deleting…' : 'Delete Unit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
