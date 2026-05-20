'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Link as MuiLink,
  MenuItem,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

// ── Section header card ────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ mb: 3, borderColor: '#E5E1D8' }}>
      <Box sx={{ bgcolor: '#F1EEE8', px: 3, py: 1.75, borderBottom: '1px solid #E5E1D8' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1C0F06' }}>
          {title}
        </Typography>
      </Box>
      <CardContent sx={{ p: 3 }}>{children}</CardContent>
    </Card>
  )
}

// ── Field types ────────────────────────────────────────────────────────────

interface CustomFormField {
  key: string
  label: string
  isCustom: boolean
  fieldType?: 'text' | 'select' | 'checkbox'
  options?: string[]
  helpText?: string
}

interface TenantForm {
  // Contact
  firstName: string
  lastName: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  smsOptIn: boolean
  // Account & Access
  email: string
  username: string
  loginDisabled: boolean
  // Personal Information
  driversLicenseNumber: string
  driversLicenseState: string
  idPhotoUrl: string
  idPhotoIsProfile: boolean
  howDidYouHear: string
  // Alternate Contact
  alternateContactName: string
  alternatePhone: string
  alternateEmail: string
  // Additional Information
  howDidYouHearOther: string
  // Notes
  taxExempt: boolean
  lateFeeExempt: boolean
  lateLienNotificationsDisabled: boolean
  invoiceNote: string
  notes: string
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function EditProfilePage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [facilityName, setFacilityName] = useState('this facility')
  const [hearOptions, setHearOptions] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<CustomFormField[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})

  const [form, setForm] = useState<TenantForm>({
    firstName: '', lastName: '',
    address: '', city: '', state: '', zip: '', phone: '',
    smsOptIn: false,
    email: '', username: '', loginDisabled: false,
    driversLicenseNumber: '', driversLicenseState: '',
    idPhotoUrl: '', idPhotoIsProfile: false,
    howDidYouHear: '',
    alternateContactName: '', alternatePhone: '', alternateEmail: '',
    howDidYouHearOther: '',
    taxExempt: false, lateFeeExempt: false, lateLienNotificationsDisabled: false,
    invoiceNote: '', notes: '',
  })

  useSetAdminPageTitle('Edit Profile')

  const load = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(`/api/tenants/${tenantId}`),
        fetch('/api/settings'),
      ])
      const tJson = await tRes.json()
      const sJson = await sRes.json()

      if (sJson.success) {
        setFacilityName(sJson.data?.facilityName ?? 'this facility')
        const hear = sJson.data?.customerFormFields?.find((f: any) => f.key === 'howDidYouHear')
        setHearOptions(hear?.options ?? [])
        setCustomFields(
          (sJson.data?.customerFormFields ?? [])
            .filter((f: any) => f.isCustom && f.showOnSignup !== false)
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        )
      }

      if (!tJson.success) {
        setError(tJson.error ?? 'Failed to load')
        return
      }
      const t = tJson.data
      setForm({
        firstName: t.firstName ?? '',
        lastName: t.lastName ?? '',
        address: t.address ?? '',
        city: t.city ?? '',
        state: t.state ?? '',
        zip: t.zip ?? '',
        phone: t.phone ?? '',
        smsOptIn: !!t.smsOptIn,
        email: t.email ?? '',
        username: t.username ?? t.email ?? '',
        loginDisabled: !!t.loginDisabled,
        driversLicenseNumber: t.driversLicenseNumber ?? t.driversLicense ?? '',
        driversLicenseState: t.driversLicenseState ?? '',
        idPhotoUrl: t.idPhotoUrl ?? '',
        idPhotoIsProfile: !!t.idPhotoIsProfile,
        howDidYouHear: t.howDidYouHear ?? '',
        alternateContactName: t.alternateContactName ?? '',
        alternatePhone: t.alternatePhone ?? '',
        alternateEmail: t.alternateEmail ?? '',
        howDidYouHearOther: t.howDidYouHearOther ?? '',
        taxExempt: !!t.taxExempt,
        lateFeeExempt: !!t.lateFeeExempt,
        lateLienNotificationsDisabled: !!t.lateLienNotificationsDisabled,
        invoiceNote: t.invoiceNote ?? '',
        notes: t.notes ?? '',
      })
      setCustomFieldValues(t.customFields ?? {})
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const update = <K extends keyof TenantForm>(key: K, value: TenantForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const [firstName, ...rest] = (`${form.firstName} ${form.lastName}`).trim().split(/\s+/)
      const lastName = rest.join(' ')
      const payload = {
        firstName: form.firstName || firstName || '',
        lastName: form.lastName || lastName || '',
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        phone: form.phone,
        smsOptIn: form.smsOptIn,
        smsConsent: form.smsOptIn,
        email: form.email,
        username: form.username,
        loginDisabled: form.loginDisabled,
        driversLicenseNumber: form.driversLicenseNumber,
        driversLicenseState: form.driversLicenseState,
        idPhotoUrl: form.idPhotoUrl,
        idPhotoIsProfile: form.idPhotoIsProfile,
        howDidYouHear: form.howDidYouHear,
        alternateContactName: form.alternateContactName,
        alternatePhone: form.alternatePhone,
        alternateEmail: form.alternateEmail,
        howDidYouHearOther: form.howDidYouHearOther,
        taxExempt: form.taxExempt,
        lateFeeExempt: form.lateFeeExempt,
        lateLienNotificationsDisabled: form.lateLienNotificationsDisabled,
        invoiceNote: form.invoiceNote,
        notes: form.notes,
        customFields: customFieldValues,
      }
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to update')
      setSuccess('Customer updated')
      router.push(`/admin/tenants/${tenantId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handlePhotoUpload(file: File) {
    setUploading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Upload failed')
      update('idPhotoUrl', json.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleArchive() {
    if (!confirm('Archive this customer? They will be moved out of active status.')) return
    const res = await fetch(`/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true, status: 'moved_out' }),
    })
    const json = await res.json()
    if (json.success) router.push('/admin/tenants')
    else setError(json.error ?? 'Failed to archive')
  }

  async function handleWaitingList() {
    const res = await fetch(`/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onWaitingList: true }),
    })
    const json = await res.json()
    if (json.success) setSuccess('Added to waiting list')
    else setError(json.error ?? 'Failed to update')
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  const fullName = `${form.firstName} ${form.lastName}`.trim()

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header — breadcrumb is rendered by the admin layout's app bar. */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ color: '#D97757', fontWeight: 700 }}>
          Edit Profile
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={handleWaitingList} size="small" sx={{ bgcolor: '#B8BCC4', color: 'white', textTransform: 'none', '&:hover': { bgcolor: '#A0A4AC' } }}>
            Add To Waiting List
          </Button>
          <Button onClick={handleArchive} size="small" sx={{ bgcolor: '#B8BCC4', color: 'white', textTransform: 'none', '&:hover': { bgcolor: '#A0A4AC' } }}>
            Archive
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Contact Information */}
      <SectionCard title="Contact Information">
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Full Name <span style={{ color: '#D97757' }}>†</span></Typography>
            <TextField
              fullWidth size="small"
              value={fullName}
              onChange={(e) => {
                const parts = e.target.value.trim().split(/\s+/)
                update('firstName', parts[0] ?? '')
                update('lastName', parts.slice(1).join(' '))
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Address</Typography>
            <TextField fullWidth size="small" value={form.address} onChange={(e) => update('address', e.target.value)} />
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>City</Typography>
            <TextField fullWidth size="small" value={form.city} onChange={(e) => update('city', e.target.value)} />
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>State</Typography>
            <TextField fullWidth size="small" value={form.state} onChange={(e) => update('state', e.target.value)} />
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Zip</Typography>
            <TextField fullWidth size="small" value={form.zip} onChange={(e) => update('zip', e.target.value)} />
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Cell phone <span style={{ color: '#D97757' }}>†</span></Typography>
            <TextField fullWidth size="small" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox checked={form.smsOptIn} onChange={(e) => update('smsOptIn', e.target.checked)} sx={{ color: '#3B82F6', '&.Mui-checked': { color: '#3B82F6' } }} />
              }
              label="This customer agrees to receive text message communications from this facility."
              sx={{ '& .MuiTypography-root': { fontSize: '0.875rem' } }}
            />
          </Grid>
        </Grid>
      </SectionCard>

      {/* Account & Access */}
      <SectionCard title="Account & Access">
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          All fields are required to create login credentials.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Email</Typography>
            <TextField fullWidth size="small" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Username</Typography>
            <TextField fullWidth size="small" value={form.username} onChange={(e) => update('username', e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <MuiLink
              component="button"
              type="button"
              onClick={() => setPwOpen(true)}
              sx={{ color: '#3B82F6', fontSize: '0.875rem' }}
            >
              Change Customer Password
            </MuiLink>
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox checked={form.loginDisabled} onChange={(e) => update('loginDisabled', e.target.checked)} />
              }
              label="Disable customer login"
              sx={{ '& .MuiTypography-root': { fontSize: '0.875rem' } }}
            />
          </Grid>
        </Grid>
      </SectionCard>

      {/* Personal Information */}
      <SectionCard title="Personal Information">
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Drivers license number <span style={{ color: '#D97757' }}>†</span></Typography>
            <TextField fullWidth size="small" value={form.driversLicenseNumber} onChange={(e) => update('driversLicenseNumber', e.target.value)} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>State <span style={{ color: '#D97757' }}>†</span></Typography>
            <TextField fullWidth size="small" value={form.driversLicenseState} onChange={(e) => update('driversLicenseState', e.target.value)} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Photo ID (Driver&apos;s License or Government Issued ID) <span style={{ color: '#D97757' }}>†</span>
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mt: 0.5 }}>
              {form.idPhotoUrl ? (
                <Box
                  component="img"
                  src={form.idPhotoUrl}
                  alt="Photo ID"
                  sx={{ width: 160, height: 110, objectFit: 'cover', borderRadius: 1, border: '1px solid #E5E1D8' }}
                />
              ) : (
                <Box
                  sx={{ width: 160, height: 110, bgcolor: '#F1EEE8', border: '1px dashed #B8BCC4', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', fontSize: '0.75rem' }}
                >
                  No photo
                </Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Button
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  sx={{ bgcolor: '#3B82F6', color: 'white', textTransform: 'none', '&:hover': { bgcolor: '#2563EB' } }}
                >
                  {uploading ? 'Uploading…' : (form.idPhotoUrl ? 'Replace' : 'Upload')}
                </Button>
                {form.idPhotoUrl && (
                  <Button
                    size="small"
                    onClick={() => update('idPhotoUrl', '')}
                    sx={{ bgcolor: '#D97757', color: 'white', textTransform: 'none', '&:hover': { bgcolor: '#C56544' } }}
                  >
                    Delete
                  </Button>
                )}
              </Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handlePhotoUpload(file)
                  e.target.value = ''
                }}
              />
            </Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.idPhotoIsProfile}
                  onChange={(e) => update('idPhotoIsProfile', e.target.checked)}
                  disabled={!form.idPhotoUrl}
                />
              }
              label="Make Profile Picture"
              sx={{ mt: 0.5, '& .MuiTypography-root': { fontSize: '0.8rem' } }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              How did the customer hear about {facilityName}?
            </Typography>
            <TextField
              select fullWidth size="small"
              value={form.howDidYouHear}
              onChange={(e) => update('howDidYouHear', e.target.value)}
            >
              <MenuItem value="">—</MenuItem>
              {hearOptions.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </SectionCard>

      {/* Alternate Contact Information */}
      <SectionCard title="Alternate Contact Information">
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Contact <span style={{ color: '#D97757' }}>†</span></Typography>
            <TextField fullWidth size="small" value={form.alternateContactName} onChange={(e) => update('alternateContactName', e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Phone <span style={{ color: '#D97757' }}>†</span></Typography>
            <TextField fullWidth size="small" value={form.alternatePhone} onChange={(e) => update('alternatePhone', e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Email</Typography>
            <TextField fullWidth size="small" value={form.alternateEmail} onChange={(e) => update('alternateEmail', e.target.value)} />
          </Grid>
        </Grid>
      </SectionCard>

      {/* Additional Information (free-form + admin-defined custom fields) */}
      <SectionCard title="Additional Information">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>How did you hear about us?</Typography>
            <TextField fullWidth size="small" value={form.howDidYouHearOther} onChange={(e) => update('howDidYouHearOther', e.target.value)} />
          </Grid>
          {customFields.map((field) => (
            <Grid item xs={12} md={6} key={field.key}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{field.label}</Typography>
              {field.fieldType === 'select' ? (
                <TextField
                  select fullWidth size="small"
                  value={customFieldValues[field.key] ?? ''}
                  onChange={(e) => setCustomFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  helperText={field.helpText}
                >
                  <MenuItem value="">—</MenuItem>
                  {(field.options ?? []).map((opt) => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </TextField>
              ) : field.fieldType === 'checkbox' ? (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={customFieldValues[field.key] === 'true'}
                      onChange={(e) => setCustomFieldValues((v) => ({ ...v, [field.key]: e.target.checked ? 'true' : 'false' }))}
                    />
                  }
                  label={field.helpText ?? ''}
                />
              ) : (
                <TextField
                  fullWidth size="small"
                  value={customFieldValues[field.key] ?? ''}
                  onChange={(e) => setCustomFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  helperText={field.helpText}
                />
              )}
            </Grid>
          ))}
        </Grid>
      </SectionCard>

      {/* Notes */}
      <SectionCard title="Notes">
        <FormControlLabel
          control={
            <Checkbox checked={form.taxExempt} onChange={(e) => update('taxExempt', e.target.checked)} />
          }
          label="Tax exempt?"
          sx={{ '& .MuiTypography-root': { fontSize: '0.875rem', fontWeight: 600 } }}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', ml: 4, mt: -0.5, mb: 1.5 }}>
          Select if this customer should be tax exempt; this will also add a tax exempt designation to invoices and receipts.
        </Typography>

        <FormControlLabel
          control={
            <Checkbox checked={form.lateFeeExempt} onChange={(e) => update('lateFeeExempt', e.target.checked)} />
          }
          label="Late fee exempt?"
          sx={{ '& .MuiTypography-root': { fontSize: '0.875rem', fontWeight: 600 } }}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', ml: 4, mt: -0.5, mb: 2 }}>
          Select if you want to exempt the late fee for this customer.
        </Typography>

        <FormControlLabel
          control={
            <Checkbox
              checked={form.lateLienNotificationsDisabled}
              onChange={(e) => update('lateLienNotificationsDisabled', e.target.checked)}
            />
          }
          label="Disable Late/Lien notifications?"
          sx={{ '& .MuiTypography-root': { fontSize: '0.875rem', fontWeight: 600 } }}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', ml: 4, mt: -0.5, mb: 2 }}>
          Suppress every Late/Lien email, text, and print letter for this tenant. Storable recommends pairing this with Late Fee Exempt when granting a full delinquency exemption.
        </Typography>

        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mt: 1 }}>Invoice note</Typography>
        <TextField
          fullWidth multiline minRows={3}
          value={form.invoiceNote}
          onChange={(e) => update('invoiceNote', e.target.value)}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, mb: 2 }}>
          The text here appears on this customer&apos;s non-postcard invoices.
        </Typography>

        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>Notes</Typography>
        <TextField
          fullWidth multiline minRows={3}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
          These notes appear at the top of the customer information.
        </Typography>
      </SectionCard>

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
        † Field is required for customers during an online rental, waiting list signup, or both.
      </Typography>

      {/* Footer actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 4 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          disableElevation
          sx={{ bgcolor: '#3B82F6', textTransform: 'none', px: 3, '&:hover': { bgcolor: '#2563EB' } }}
        >
          {saving ? 'Saving…' : 'Update Customer'}
        </Button>
        <MuiLink
          component="button"
          type="button"
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          sx={{ color: '#3B82F6' }}
        >
          Cancel
        </MuiLink>
      </Box>

      <ChangePasswordDialog
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        tenantId={tenantId}
        onSaved={() => setSuccess('Password updated')}
      />

      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>
      </Snackbar>
    </Box>
  )
}

// ── Change Password Dialog ─────────────────────────────────────────────────

function ChangePasswordDialog({ open, onClose, tenantId, onSaved }: {
  open: boolean; onClose: () => void; tenantId: string; onSaved: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setPassword(''); setConfirm(''); setErr(null) }
  }, [open])

  async function handleSave() {
    if (password !== confirm) { setErr('Passwords do not match'); return }
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return }
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')
      onSaved()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Change Customer Password</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <TextField
          fullWidth size="small" type="password" label="New password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          sx={{ mt: 1 }}
        />
        <TextField
          fullWidth size="small" type="password" label="Confirm password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} disableElevation>
          {saving ? 'Saving…' : 'Save Password'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
