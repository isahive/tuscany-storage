'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Grid,
  InputAdornment,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'

// ── Types ─────────────────────────────────────────────────────────────────────

// All dollar fields stored as display strings (e.g. "20.00")
interface FeesFormValues {
  lateFeeAfterDays: string
  lateFeeAmount: string   // dollars, display value
  nsfFeeAmount: string    // dollars, display value
  auctionFeeAmount: string // dollars, display value
}

const EMPTY_FORM: FeesFormValues = {
  lateFeeAfterDays: '',
  lateFeeAmount: '',
  nsfFeeAmount: '',
  auctionFeeAmount: '',
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

function dollarsToCents(dollars: string): number {
  const val = parseFloat(dollars)
  return isNaN(val) ? 0 : Math.round(val * 100)
}

function formatDollar(dollars: string): string {
  const val = parseFloat(dollars)
  if (isNaN(val)) return '$0.00'
  return `$${val.toFixed(2)}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FeesSettingsPage() {
  const [form, setForm] = useState<FeesFormValues>(EMPTY_FORM)
  const [saved, setSaved] = useState<FeesFormValues>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/settings')
      const json = await res.json()
      if (!json.success) throw new Error('Failed to load settings')
      const d = json.data
      const values: FeesFormValues = {
        lateFeeAfterDays: d.lateFeeAfterDays != null ? String(d.lateFeeAfterDays) : '',
        lateFeeAmount: d.lateFeeAmount != null ? centsToDollars(d.lateFeeAmount) : '',
        nsfFeeAmount: d.nsfFeeAmount != null ? centsToDollars(d.nsfFeeAmount) : '',
        auctionFeeAmount: d.auctionFeeAmount != null ? centsToDollars(d.auctionFeeAmount) : '',
      }
      setForm(values)
      setSaved(values)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const body = {
        lateFeeAfterDays: parseInt(form.lateFeeAfterDays, 10) || 0,
        lateFeeAmount: dollarsToCents(form.lateFeeAmount),
        nsfFeeAmount: dollarsToCents(form.nsfFeeAmount),
        auctionFeeAmount: dollarsToCents(form.auctionFeeAmount),
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) throw new Error('Failed to save settings')
      setSaved(form)
      setSnackbarOpen(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  // ── Field helpers ──────────────────────────────────────────────────────────

  const setField = (key: keyof FeesFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))

  // ── Skeleton ───────────────────────────────────────────────────────────────

  const FieldSkeleton = ({ width }: { width?: number | string }) => (
    <Skeleton
      variant="rectangular"
      height={40}
      width={width}
      sx={{ borderRadius: 1 }}
    />
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            component={Link}
            href="/admin/settings"
            startIcon={<ArrowBackIcon />}
            size="small"
            sx={{
              color: '#B8914A',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': { bgcolor: 'rgba(184,145,74,0.08)' },
            }}
          >
            Setup
          </Button>
          <Typography
            variant="h5"
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              color: '#1C0F06',
            }}
          >
            Fees &amp; Charges
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!isDirty || saving || loading}
          sx={{
            bgcolor: '#B8914A',
            '&:hover': { bgcolor: '#9A7A3E' },
            '&:disabled': { bgcolor: 'rgba(184,145,74,0.4)', color: 'white' },
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>

      {/* Fetch error */}
      {fetchError && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={fetchSettings}>
              Retry
            </Button>
          }
        >
          {fetchError}
        </Alert>
      )}

      {/* Save error */}
      {saveError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      {/* Form */}
      <Grid container spacing={3}>

        {/* Late Fee */}
        <Grid item xs={12}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600, color: '#1C0F06', mb: 1.5 }}
          >
            Late Fee
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {loading ? (
              <>
                <FieldSkeleton width={120} />
                <FieldSkeleton width={180} />
              </>
            ) : (
              <>
                <Box>
                  <TextField
                    label="Days until late fee"
                    type="number"
                    size="small"
                    value={form.lateFeeAfterDays}
                    onChange={setField('lateFeeAfterDays')}
                    inputProps={{ min: 0 }}
                    sx={{ width: 160 }}
                  />
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                    Currently: {form.lateFeeAfterDays || '0'} day{form.lateFeeAfterDays === '1' ? '' : 's'}
                  </Typography>
                </Box>
                <Box>
                  <TextField
                    label="Late fee amount"
                    type="number"
                    size="small"
                    value={form.lateFeeAmount}
                    onChange={setField('lateFeeAmount')}
                    inputProps={{ min: 0, step: 0.01 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    sx={{ width: 180 }}
                  />
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                    Currently: {formatDollar(form.lateFeeAmount)}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </Grid>

        {/* NSF Fee */}
        <Grid item xs={12} sm={6}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600, color: '#1C0F06', mb: 1.5 }}
          >
            NSF Fee
          </Typography>
          {loading ? (
            <FieldSkeleton width={180} />
          ) : (
            <Box>
              <TextField
                label="NSF fee amount"
                type="number"
                size="small"
                value={form.nsfFeeAmount}
                onChange={setField('nsfFeeAmount')}
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                sx={{ width: 180 }}
              />
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                Currently: {formatDollar(form.nsfFeeAmount)}
              </Typography>
            </Box>
          )}
        </Grid>

        {/* Auction / Sale Fee */}
        <Grid item xs={12} sm={6}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600, color: '#1C0F06', mb: 1.5 }}
          >
            Auction / Sale Fee
          </Typography>
          {loading ? (
            <FieldSkeleton width={180} />
          ) : (
            <Box>
              <TextField
                label="Auction fee amount"
                type="number"
                size="small"
                value={form.auctionFeeAmount}
                onChange={setField('auctionFeeAmount')}
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                sx={{ width: 180 }}
              />
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                Currently: {formatDollar(form.auctionFeeAmount)}
              </Typography>
            </Box>
          )}
        </Grid>

      </Grid>

      {/* Success snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          variant="filled"
          sx={{ bgcolor: '#B8914A', color: 'white', fontWeight: 500 }}
        >
          Saved
        </Alert>
      </Snackbar>
    </Box>
  )
}
