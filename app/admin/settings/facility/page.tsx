'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Grid,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FacilityFormValues {
  facilityName: string
  facilityPhone: string
  facilityEmail: string
  facilityAddress: string
  facilityCity: string
  facilityState: string
  facilityZip: string
  accessHoursStart: string
  accessHoursEnd: string
  pdkEntryDeviceIds: string[]
  pdkExitDeviceIds: string[]
}

interface PdkDeviceOption {
  id: string
  name: string
  type: string | null
}

const EMPTY_FORM: FacilityFormValues = {
  facilityName: '',
  facilityPhone: '',
  facilityEmail: '',
  facilityAddress: '',
  facilityCity: '',
  facilityState: '',
  facilityZip: '',
  accessHoursStart: '',
  accessHoursEnd: '',
  pdkEntryDeviceIds: [],
  pdkExitDeviceIds: [],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FacilitySettingsPage() {
  const [form, setForm] = useState<FacilityFormValues>(EMPTY_FORM)
  const [saved, setSaved] = useState<FacilityFormValues>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  // PDK device list — null = not loaded yet, [] = PDK not configured. Failure
  // to load is non-fatal: the form still renders, just without the picker.
  const [pdkDevices, setPdkDevices] = useState<PdkDeviceOption[] | null>(null)

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
      const values: FacilityFormValues = {
        facilityName: d.facilityName ?? '',
        facilityPhone: d.facilityPhone ?? '',
        facilityEmail: d.facilityEmail ?? '',
        facilityAddress: d.facilityAddress ?? '',
        facilityCity: d.facilityCity ?? '',
        facilityState: d.facilityState ?? '',
        facilityZip: d.facilityZip ?? '',
        accessHoursStart: d.accessHoursStart ?? '',
        accessHoursEnd: d.accessHoursEnd ?? '',
        pdkEntryDeviceIds: Array.isArray(d.pdkEntryDeviceIds) ? d.pdkEntryDeviceIds : [],
        pdkExitDeviceIds: Array.isArray(d.pdkExitDeviceIds) ? d.pdkExitDeviceIds : [],
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

  // Load PDK devices once. Independent of fetchSettings — admins should be
  // able to fix typo'd settings even if PDK is briefly unreachable.
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/pdk/devices')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json?.success && Array.isArray(json.data)) setPdkDevices(json.data)
        else setPdkDevices([])
      })
      .catch(() => { if (!cancelled) setPdkDevices([]) })
    return () => { cancelled = true }
  }, [])

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

  // ── Field helper ───────────────────────────────────────────────────────────

  const field = (key: keyof FacilityFormValues) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
    size: 'small' as const,
  })

  // ── Skeleton ───────────────────────────────────────────────────────────────

  const FieldSkeleton = () => (
    <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
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
              fontFamily: 'var(--font-outfit), system-ui, sans-serif',
              fontWeight: 700,
              color: '#2C3826',
            }}
          >
            Facility Info
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
      <Grid container spacing={2.5}>
        {/* Facility Name */}
        <Grid item xs={12}>
          {loading ? (
            <FieldSkeleton />
          ) : (
            <TextField fullWidth label="Facility Name" {...field('facilityName')} />
          )}
        </Grid>

        {/* Phone */}
        <Grid item xs={12} sm={6}>
          {loading ? (
            <FieldSkeleton />
          ) : (
            <TextField fullWidth label="Phone" {...field('facilityPhone')} />
          )}
        </Grid>

        {/* Email */}
        <Grid item xs={12} sm={6}>
          {loading ? (
            <FieldSkeleton />
          ) : (
            <TextField
              fullWidth
              label="Email"
              type="email"
              {...field('facilityEmail')}
            />
          )}
        </Grid>

        {/* Address */}
        <Grid item xs={12}>
          {loading ? (
            <FieldSkeleton />
          ) : (
            <TextField fullWidth label="Address" {...field('facilityAddress')} />
          )}
        </Grid>

        {/* City / State / ZIP */}
        <Grid item xs={12} sm={5}>
          {loading ? (
            <FieldSkeleton />
          ) : (
            <TextField fullWidth label="City" {...field('facilityCity')} />
          )}
        </Grid>
        <Grid item xs={6} sm={3}>
          {loading ? (
            <FieldSkeleton />
          ) : (
            <TextField
              fullWidth
              label="State"
              inputProps={{ maxLength: 2 }}
              {...field('facilityState')}
            />
          )}
        </Grid>
        <Grid item xs={6} sm={4}>
          {loading ? (
            <FieldSkeleton />
          ) : (
            <TextField
              fullWidth
              label="ZIP"
              inputProps={{ maxLength: 10 }}
              {...field('facilityZip')}
            />
          )}
        </Grid>

        {/* Access Hours */}
        <Grid item xs={12} sm={6}>
          {loading ? (
            <FieldSkeleton />
          ) : (
            <TextField
              fullWidth
              label="Access Hours Start"
              type="time"
              InputLabelProps={{ shrink: true }}
              {...field('accessHoursStart')}
            />
          )}
        </Grid>
        <Grid item xs={12} sm={6}>
          {loading ? (
            <FieldSkeleton />
          ) : (
            <TextField
              fullWidth
              label="Access Hours End"
              type="time"
              InputLabelProps={{ shrink: true }}
              {...field('accessHoursEnd')}
            />
          )}
        </Grid>

        {/* PDK device mapping — only shown when PDK is configured server-side.
            The hours above only enforce against the devices tagged "entry"
            here. Devices tagged "exit" stay open 24/7 so tenants can leave
            after hours. */}
        {pdkDevices && pdkDevices.length > 0 && (
          <>
            <Grid item xs={12}>
              <Typography
                variant="subtitle2"
                sx={{ color: '#6B6B6B', mt: 1 }}
              >
                Gate hardware (PDK)
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                multiple
                size="small"
                options={pdkDevices}
                getOptionLabel={(o) => o.name}
                value={pdkDevices.filter((d) => form.pdkEntryDeviceIds.includes(d.id))}
                onChange={(_, val) =>
                  setForm((prev) => ({ ...prev, pdkEntryDeviceIds: val.map((v) => v.id) }))
                }
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const tagProps = getTagProps({ index })
                    return <Chip {...tagProps} key={option.id} label={option.name} size="small" />
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Entry readers (enforce hours)"
                    helperText="Outside readers — denied outside access hours."
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                multiple
                size="small"
                options={pdkDevices}
                getOptionLabel={(o) => o.name}
                value={pdkDevices.filter((d) => form.pdkExitDeviceIds.includes(d.id))}
                onChange={(_, val) =>
                  setForm((prev) => ({ ...prev, pdkExitDeviceIds: val.map((v) => v.id) }))
                }
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const tagProps = getTagProps({ index })
                    return <Chip {...tagProps} key={option.id} label={option.name} size="small" />
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Exit readers (24/7)"
                    helperText="Inside readers — allowed any time so tenants can leave."
                  />
                )}
              />
            </Grid>
          </>
        )}
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
