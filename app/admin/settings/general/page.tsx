'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'

const TIME_ZONES = [
  { label: '(GMT-08:00) Pacific Time (US & Canada)', value: 'America/Los_Angeles' },
  { label: '(GMT-07:00) Mountain Time (US & Canada)', value: 'America/Denver' },
  { label: '(GMT-06:00) Central Time (US & Canada)', value: 'America/Chicago' },
  { label: '(GMT-05:00) Eastern Time (US & Canada)', value: 'America/New_York' },
]

const DATE_FORMATS = [
  { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
  { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
]

const DIMENSION_FORMATS = [
  { label: '10w x 10l x 10h', value: '10w x 10l x 10h' },
  { label: '10 x 10 x 10', value: '10 x 10 x 10' },
  { label: "10' x 10' x 10'", value: "10' x 10' x 10'" },
]

interface FormState {
  locale: string
  currency: string
  dateFormat: string
  timeZone: string
  phoneFormat: string
  dimensionFormat: string
}

const DEFAULTS: FormState = {
  locale: 'en-US',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  timeZone: 'America/New_York',
  phoneFormat: '(555) 555-5555',
  dimensionFormat: '10w x 10l x 10h',
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1C0F06', mb: 0.5 }}>
        {label}
      </Typography>
      {children}
      {hint && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
          {hint}
        </Typography>
      )}
    </Box>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GeneralSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULTS)
  const [savedForm, setSavedForm] = useState<FormState>(DEFAULTS)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const d = j.data
          const loaded: FormState = {
            locale: d.locale ?? DEFAULTS.locale,
            currency: d.currency ?? DEFAULTS.currency,
            dateFormat: d.dateFormat ?? DEFAULTS.dateFormat,
            timeZone: d.timeZone ?? DEFAULTS.timeZone,
            phoneFormat: d.phoneFormat ?? DEFAULTS.phoneFormat,
            dimensionFormat: d.dimensionFormat ?? DEFAULTS.dimensionFormat,
          }
          setForm(loaded)
          setSavedForm(loaded)
        }
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to save')
      setSavedForm(form)
      setSavedOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  const selectSx = {
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#EDE5D8' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#B8914A' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#B8914A' },
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          component={Link}
          href="/admin/settings"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}
        >
          Setup
        </Button>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06', flex: 1 }}>
          General Settings
        </Typography>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !isDirty}
          sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, '&.Mui-disabled': { bgcolor: '#D4B87A', color: 'white' }, textTransform: 'none', fontWeight: 600, px: 2.5 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}

      <Box sx={{ maxWidth: 640, bgcolor: 'white', border: '1px solid #EDE5D8', borderRadius: 2, p: 3 }}>

        {/* Locale */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#B8914A', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 2 }}>
          Locale
        </Typography>

        <Field label="Country / Currency" hint="Affects how monetary values are displayed throughout the system.">
          <Select
            fullWidth size="small" value={form.currency} onChange={(e) => set('currency', e.target.value)} sx={selectSx}
          >
            <MenuItem value="USD">United States — Dollar ($) — USD</MenuItem>
            <MenuItem value="EUR">European Union — Euro (€) — EUR</MenuItem>
            <MenuItem value="GBP">United Kingdom — Pound (£) — GBP</MenuItem>
          </Select>
        </Field>

        <Field label="Date Format" hint="Dates will be shown in this format throughout your website.">
          <Select fullWidth size="small" value={form.dateFormat} onChange={(e) => set('dateFormat', e.target.value)} sx={selectSx}>
            {DATE_FORMATS.map((f) => (
              <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
            ))}
          </Select>
        </Field>

        <Field label="Time Zone">
          <Select fullWidth size="small" value={form.timeZone} onChange={(e) => set('timeZone', e.target.value)} sx={selectSx}>
            {TIME_ZONES.map((tz) => (
              <MenuItem key={tz.value} value={tz.value}>{tz.label}</MenuItem>
            ))}
          </Select>
        </Field>

        <Divider sx={{ my: 3, borderColor: '#EDE5D8' }} />

        {/* Display formats */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#B8914A', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 2 }}>
          Display Formats
        </Typography>

        <Field label="Phone Number Format" hint="Phone numbers will be shown in this format throughout your website. International numbers will be shown with the country code.">
          <TextField
            fullWidth size="small" value={form.phoneFormat}
            onChange={(e) => set('phoneFormat', e.target.value)}
            placeholder="(555) 555-5555"
            sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#EDE5D8' }, '&:hover fieldset': { borderColor: '#B8914A' }, '&.Mui-focused fieldset': { borderColor: '#B8914A' } } }}
          />
        </Field>

        <Field label="Unit Type Dimension Format" hint="Unit types will use this format throughout your website.">
          <Select fullWidth size="small" value={form.dimensionFormat} onChange={(e) => set('dimensionFormat', e.target.value)} sx={selectSx}>
            {DIMENSION_FORMATS.map((f) => (
              <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
            ))}
          </Select>
        </Field>

      </Box>

      <Snackbar open={savedOpen} autoHideDuration={3000} onClose={() => setSavedOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSavedOpen(false)} severity="success" variant="filled" sx={{ bgcolor: '#B8914A', color: 'white', fontWeight: 500, '& .MuiAlert-icon': { color: 'white' } }}>
          Settings saved
        </Alert>
      </Snackbar>
    </Box>
  )
}
