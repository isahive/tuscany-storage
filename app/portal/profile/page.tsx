'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'

interface ProfileForm {
  firstName: string
  lastName: string
  phone: string
  alternatePhone: string
  alternateEmail: string
  address: string
  city: string
  state: string
  zip: string
}

const EMPTY: ProfileForm = {
  firstName: '',
  lastName: '',
  phone: '',
  alternatePhone: '',
  alternateEmail: '',
  address: '',
  city: '',
  state: '',
  zip: '',
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: '#EDE5D8' },
    '&:hover fieldset': { borderColor: '#B8914A' },
    '&.Mui-focused fieldset': { borderColor: '#B8914A' },
    '&.Mui-disabled fieldset': { borderColor: '#EDE5D8' },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: '#B8914A' },
}

export default function ProfilePage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [canEdit, setCanEdit] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [form, setForm] = useState<ProfileForm>(EMPTY)
  const [savedForm, setSavedForm] = useState<ProfileForm>(EMPTY)
  const [email, setEmail] = useState('')

  useEffect(() => {
    async function load() {
      try {
        // Check permission setting
        const settingsRes = await fetch('/api/settings/public')
        const settingsJson = await settingsRes.json()
        if (settingsJson.success) {
          setCanEdit(settingsJson.data.customersCanEditProfile ?? true)
        }

        // Load tenant profile
        const tenantId = session?.user?.id
        if (!tenantId) return
        const res = await fetch(`/api/tenants/${tenantId}`)
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to load profile')
        const t = json.data
        const loaded: ProfileForm = {
          firstName: t.firstName ?? '',
          lastName: t.lastName ?? '',
          phone: t.phone ?? '',
          alternatePhone: t.alternatePhone ?? '',
          alternateEmail: t.alternateEmail ?? '',
          address: t.address ?? '',
          city: t.city ?? '',
          state: t.state ?? '',
          zip: t.zip ?? '',
        }
        setForm(loaded)
        setSavedForm(loaded)
        setEmail(t.email ?? '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    if (session?.user?.id) load()
  }, [session?.user?.id])

  function set(field: keyof ProfileForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleCancel() {
    setForm(savedForm)
    setEditing(false)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const tenantId = session?.user?.id
      if (!tenantId) throw new Error('Not authenticated')
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to save')
      setSavedForm(form)
      setEditing(false)
      setSavedOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
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

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <PersonIcon sx={{ color: '#B8914A', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06', flex: 1 }}>
          My Profile
        </Typography>
        {canEdit && !editing && (
          <Button
            startIcon={<EditIcon />}
            onClick={() => setEditing(true)}
            sx={{ textTransform: 'none', fontWeight: 500, color: '#B8914A', borderColor: '#B8914A', '&:hover': { borderColor: '#9A7A3E', bgcolor: 'rgba(184,145,74,0.06)' } }}
            variant="outlined"
          >
            Edit
          </Button>
        )}
        {editing && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<CancelIcon />}
              onClick={handleCancel}
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Box>
        )}
      </Box>

      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
          Profile editing is currently disabled. Please contact the facility to update your information.
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ bgcolor: 'white', border: '1px solid #EDE5D8', borderRadius: 2, p: 3, maxWidth: 680 }}>

        {/* Read-only email */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 2 }}>
          Account
        </Typography>
        <TextField
          fullWidth label="Email address" value={email} disabled size="small"
          helperText="Email cannot be changed. Contact support if needed."
          sx={{ ...fieldSx, mb: 3 }}
        />

        {/* Personal info */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 2 }}>
          Personal Information
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="First name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} disabled={!editing} size="small" sx={fieldSx} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Last name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} disabled={!editing} size="small" sx={fieldSx} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} disabled={!editing} size="small" sx={fieldSx} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Alternate phone" value={form.alternatePhone} onChange={(e) => set('alternatePhone', e.target.value)} disabled={!editing} size="small" sx={fieldSx} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Alternate email" value={form.alternateEmail} onChange={(e) => set('alternateEmail', e.target.value)} disabled={!editing} size="small" sx={fieldSx} />
          </Grid>
        </Grid>

        {/* Address */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 2 }}>
          Address
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField fullWidth label="Street address" value={form.address} onChange={(e) => set('address', e.target.value)} disabled={!editing} size="small" sx={fieldSx} />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField fullWidth label="City" value={form.city} onChange={(e) => set('city', e.target.value)} disabled={!editing} size="small" sx={fieldSx} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth label="State" value={form.state} onChange={(e) => set('state', e.target.value)} disabled={!editing} size="small" inputProps={{ maxLength: 2 }} sx={fieldSx} />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField fullWidth label="ZIP" value={form.zip} onChange={(e) => set('zip', e.target.value)} disabled={!editing} size="small" sx={fieldSx} />
          </Grid>
        </Grid>

      </Box>

      <Snackbar open={savedOpen} autoHideDuration={3000} onClose={() => setSavedOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSavedOpen(false)} severity="success" variant="filled" sx={{ bgcolor: '#B8914A', color: 'white', fontWeight: 500, '& .MuiAlert-icon': { color: 'white' } }}>
          Profile updated successfully
        </Alert>
      </Snackbar>
    </Box>
  )
}
