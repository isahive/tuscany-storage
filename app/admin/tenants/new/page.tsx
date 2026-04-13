'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'

// ── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Box sx={{ bgcolor: '#1C0F06', color: 'white', px: 2.5, py: 1.2, borderRadius: 1, mb: 2, mt: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
    </Box>
  )
}

// ── Form field settings hook ────────────────────────────────────────────────

interface FieldConfig {
  key: string
  label: string
  showOnSignup: boolean
  requiredOnSignup: boolean
  showOnWaitingList: boolean
  requiredOnWaitingList: boolean
  isCustom: boolean
  order: number
}

function useFormFieldSettings() {
  const [fields, setFields] = useState<FieldConfig[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.customerFormFields?.length) {
          setFields(json.data.customerFormFields)
        }
      })
      .finally(() => setLoaded(true))
  }, [])

  const show = useCallback(
    (key: string) => {
      if (!loaded || fields.length === 0) return true // show everything until loaded
      const f = fields.find((ff) => ff.key === key)
      return f ? f.showOnSignup : false
    },
    [fields, loaded],
  )

  const req = useCallback(
    (key: string) => {
      if (!loaded || fields.length === 0) return false
      const f = fields.find((ff) => ff.key === key)
      return f ? f.requiredOnSignup : false
    },
    [fields, loaded],
  )

  return { show, req, loaded }
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function NewCustomerPage() {
  const router = useRouter()
  const { show, req, loaded } = useFormFieldSettings()

  // Contact Information
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [phone, setPhone] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)

  // Account & Access
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [disableLogin, setDisableLogin] = useState(false)

  // Personal Information
  const [driversLicense, setDriversLicense] = useState('')
  const [dlState, setDlState] = useState('')
  const [ssn, setSsn] = useState('')
  const [employerName, setEmployerName] = useState('')
  const [employerPhone, setEmployerPhone] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [idPhoto, setIdPhoto] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState(false)
  const [referralSource, setReferralSource] = useState('Referral')
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')

  // Alternate Contact
  const [altContactName, setAltContactName] = useState('')
  const [altPhone, setAltPhone] = useState('')
  const [altEmail, setAltEmail] = useState('')
  const [altAddress, setAltAddress] = useState('')
  const [altCity, setAltCity] = useState('')
  const [altState, setAltState] = useState('')
  const [altZip, setAltZip] = useState('')

  // Notes
  const [taxExempt, setTaxExempt] = useState(false)
  const [lateFeeExempt, setLateFeeExempt] = useState(false)
  const [invoiceNote, setInvoiceNote] = useState('')
  const [notes, setNotes] = useState('')

  // State
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

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
      setIdPhoto(json.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ID upload failed')
    } finally { setUploadingId(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setDuplicateWarning(null)

    // Validation
    if (!firstName.trim() || !lastName.trim()) { setError('First and last name are required'); return }
    if (!email.trim()) { setError('Email is required'); return }
    if (!phone.trim()) { setError('Phone number is required'); return }
    if (!disableLogin) {
      if (!password) { setError('Password is required'); return }
      if (password.length < 4) { setError('Password must be at least 4 characters'); return }
      if (password !== confirmPassword) { setError('Passwords do not match'); return }
    }

    setSaving(true)
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password: disableLogin ? 'disabled_' + Math.random().toString(36).slice(2, 14) : password,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        driversLicense: driversLicense.trim() ? `${driversLicense.trim()}${dlState ? ' (' + dlState + ')' : ''}` : undefined,
        idPhotoUrl: idPhoto || undefined,
        alternatePhone: altPhone.trim() || undefined,
        alternateEmail: altEmail.trim() || undefined,
        smsOptIn,
        referralSource: referralSource || undefined,
      }

      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to create customer')

      if (json.duplicateWarning) {
        setDuplicateWarning(
          `Possible duplicate: ${json.duplicateWarning.name} at ${json.duplicateWarning.address}`
        )
      }

      // If there's a note, create it
      if (notes.trim() && json.data?._id) {
        await fetch(`/api/tenants/${json.data._id}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: notes.trim() }),
        })
      }

      // Navigate to the new tenant
      router.push(`/admin/tenants/${json.data._id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  if (!loaded) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}><CircularProgress /></Box>
  }

  // Helper: label with asterisk if required by settings
  const lbl = (label: string, key: string) => req(key) ? `${label} *` : label

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, color: '#C17B4A', fontFamily: '"Playfair Display", serif', mb: 0.5 }}
      >
        New Customer
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Tenants &nbsp;/&nbsp; New Customer
      </Typography>

      <form onSubmit={handleSubmit}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {duplicateWarning && <Alert severity="warning" sx={{ mb: 2 }}>{duplicateWarning}</Alert>}

        {/* ── Contact Information ───────────────────────────────────────── */}
        <SectionHeader title="Contact Information" />
        <Card sx={{ mb: 0 }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={2}>
              {show('name') && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField label="First Name *" fullWidth size="small" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField label="Last Name *" fullWidth size="small" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                  </Grid>
                </>
              )}
              {show('address') && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField label={lbl('Address', 'address')} fullWidth size="small" value={address} onChange={(e) => setAddress(e.target.value)} required={req('address')} />
                  </Grid>
                  <Grid item xs={12} sm={6} />
                </>
              )}
              {show('city') && (
                <Grid item xs={12} sm={3}>
                  <TextField label={lbl('City', 'city')} fullWidth size="small" value={city} onChange={(e) => setCity(e.target.value)} required={req('city')} />
                </Grid>
              )}
              {show('state') && (
                <Grid item xs={6} sm={2}>
                  <TextField label={lbl('State', 'state')} fullWidth size="small" value={state} onChange={(e) => setState(e.target.value)} required={req('state')} />
                </Grid>
              )}
              {show('zip') && (
                <Grid item xs={6} sm={2}>
                  <TextField label={lbl('Zip', 'zip')} fullWidth size="small" value={zip} onChange={(e) => setZip(e.target.value)} required={req('zip')} />
                </Grid>
              )}
              {show('cellPhone') && (
                <Grid item xs={12} sm={5}>
                  <TextField label={lbl('Cell phone', 'cellPhone')} fullWidth size="small" value={phone} onChange={(e) => setPhone(e.target.value)} required={req('cellPhone')} />
                </Grid>
              )}
              {show('phone') && (
                <Grid item xs={12} sm={5}>
                  <TextField label={lbl('Home phone', 'phone')} fullWidth size="small" value={phone} onChange={(e) => setPhone(e.target.value)} required={req('phone')} />
                </Grid>
              )}
            </Grid>
            <FormControlLabel
              control={<Checkbox checked={smsOptIn} onChange={(e) => setSmsOptIn(e.target.checked)} size="small" />}
              label={<Typography variant="body2">This customer agrees to receive text message communications from this facility</Typography>}
              sx={{ mt: 1.5 }}
            />
          </CardContent>
        </Card>

        {/* ── Account & Access ─────────────────────────────────────────── */}
        <SectionHeader title="Account & Access" />
        <Card sx={{ mb: 0 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              All fields are required to create login credentials.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField label="Email" fullWidth size="small" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Username" fullWidth size="small" value={email} disabled
                  sx={{ '& .MuiInputBase-root': { bgcolor: '#EDE5D8' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Password" fullWidth size="small" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  helperText="Must be at least 4 characters."
                  disabled={disableLogin}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Password confirmation" fullWidth size="small" type="password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={disableLogin}
                />
              </Grid>
            </Grid>
            <FormControlLabel
              control={<Checkbox checked={disableLogin} onChange={(e) => setDisableLogin(e.target.checked)} size="small" />}
              label={<Typography variant="body2">Disable customer login</Typography>}
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>

        {/* ── Personal Information ─────────────────────────────────────── */}
        <SectionHeader title="Personal Information" />
        <Card sx={{ mb: 0 }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={2}>
              {show('driversLicense') && (
                <Grid item xs={12} sm={4}>
                  <TextField label={lbl("Driver's license number", 'driversLicense')} fullWidth size="small" value={driversLicense}
                    onChange={(e) => setDriversLicense(e.target.value)} required={req('driversLicense')} />
                </Grid>
              )}
              {show('driversLicenseState') && (
                <Grid item xs={6} sm={2}>
                  <TextField label={lbl('DL State', 'driversLicenseState')} fullWidth size="small" value={dlState} onChange={(e) => setDlState(e.target.value)} required={req('driversLicenseState')} />
                </Grid>
              )}
              {show('ssn') && (
                <Grid item xs={12} sm={4}>
                  <TextField label={lbl('SSN / Tax ID', 'ssn')} fullWidth size="small" value={ssn}
                    onChange={(e) => setSsn(e.target.value)} required={req('ssn')} />
                </Grid>
              )}
              {show('idPhoto') && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                    Photo ID (Driver&apos;s License or Government Issued ID){req('idPhoto') ? ' *' : ''}
                  </Typography>
                  {idPhoto ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <img src={idPhoto} alt="ID" style={{ height: 48, borderRadius: 4, border: '1px solid #EDE5D8' }} />
                      <Button size="small" color="error" onClick={() => setIdPhoto(null)}>Remove</Button>
                    </Box>
                  ) : (
                    <Button variant="outlined" component="label" size="small" disabled={uploadingId}>
                      {uploadingId ? 'Uploading...' : 'Browse'}
                      <input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleIdUpload} />
                    </Button>
                  )}
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                    Must be a JPG, JPEG, PNG, or GIF file.
                  </Typography>
                </Grid>
              )}
              {show('employerName') && (
                <Grid item xs={12} sm={4}>
                  <TextField label={lbl('Employer name', 'employerName')} fullWidth size="small" value={employerName}
                    onChange={(e) => setEmployerName(e.target.value)} required={req('employerName')} />
                </Grid>
              )}
              {show('employerPhone') && (
                <Grid item xs={12} sm={4}>
                  <TextField label={lbl('Employer phone', 'employerPhone')} fullWidth size="small" value={employerPhone}
                    onChange={(e) => setEmployerPhone(e.target.value)} required={req('employerPhone')} />
                </Grid>
              )}
              {show('emergencyContact') && (
                <Grid item xs={12} sm={4}>
                  <TextField label={lbl('Emergency contact', 'emergencyContact')} fullWidth size="small" value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)} required={req('emergencyContact')} />
                </Grid>
              )}
              {show('emergencyPhone') && (
                <Grid item xs={12} sm={4}>
                  <TextField label={lbl('Emergency phone', 'emergencyPhone')} fullWidth size="small" value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)} required={req('emergencyPhone')} />
                </Grid>
              )}
            </Grid>
            {show('referralSource') && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>How did the customer hear about Tuscany Village Self Storage?</Typography>
                <FormControl size="small" sx={{ minWidth: 240 }}>
                  <Select value={referralSource} onChange={(e) => setReferralSource(e.target.value)}>
                    <MenuItem value="Referral">Referral</MenuItem>
                    <MenuItem value="Google">Google</MenuItem>
                    <MenuItem value="Drive By">Drive By</MenuItem>
                    <MenuItem value="Facebook">Facebook</MenuItem>
                    <MenuItem value="Flyer">Flyer</MenuItem>
                    <MenuItem value="Returning Customer">Returning Customer</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
            {show('securityQuestion') && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}>
                  <TextField label={lbl('Security question', 'securityQuestion')} fullWidth size="small" value={securityQuestion}
                    onChange={(e) => setSecurityQuestion(e.target.value)} required={req('securityQuestion')} />
                </Grid>
                {show('securityAnswer') && (
                  <Grid item xs={12} sm={6}>
                    <TextField label={lbl('Security answer', 'securityAnswer')} fullWidth size="small" value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)} required={req('securityAnswer')} />
                  </Grid>
                )}
              </Grid>
            )}
          </CardContent>
        </Card>

        {/* ── Alternate Contact Information ─────────────────────────────── */}
        {(show('alternateContact') || show('alternatePhone') || show('alternateEmail') || show('alternateAddress')) && (
          <>
            <SectionHeader title="Alternate Contact Information" />
            <Card sx={{ mb: 0 }}>
              <CardContent sx={{ p: 3 }}>
                <Grid container spacing={2}>
                  {show('alternateContact') && (
                    <Grid item xs={12} sm={6}>
                      <TextField label={lbl('Contact', 'alternateContact')} fullWidth size="small" value={altContactName} onChange={(e) => setAltContactName(e.target.value)} required={req('alternateContact')} />
                    </Grid>
                  )}
                  {show('alternatePhone') && (
                    <Grid item xs={12} sm={6}>
                      <TextField label={lbl('Phone', 'alternatePhone')} fullWidth size="small" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} required={req('alternatePhone')} />
                    </Grid>
                  )}
                  {show('alternateEmail') && (
                    <Grid item xs={12} sm={6}>
                      <TextField label={lbl('Email', 'alternateEmail')} fullWidth size="small" type="email" value={altEmail} onChange={(e) => setAltEmail(e.target.value)} required={req('alternateEmail')} />
                    </Grid>
                  )}
                  {show('alternateAddress') && (
                    <Grid item xs={12} sm={6}>
                      <TextField label={lbl('Address', 'alternateAddress')} fullWidth size="small" value={altAddress} onChange={(e) => setAltAddress(e.target.value)} required={req('alternateAddress')} />
                    </Grid>
                  )}
                  {show('alternateCity') && (
                    <Grid item xs={12} sm={3}>
                      <TextField label={lbl('City', 'alternateCity')} fullWidth size="small" value={altCity} onChange={(e) => setAltCity(e.target.value)} required={req('alternateCity')} />
                    </Grid>
                  )}
                  {show('alternateState') && (
                    <Grid item xs={6} sm={2}>
                      <TextField label={lbl('State', 'alternateState')} fullWidth size="small" value={altState} onChange={(e) => setAltState(e.target.value)} required={req('alternateState')} />
                    </Grid>
                  )}
                  {show('alternateZip') && (
                    <Grid item xs={6} sm={2}>
                      <TextField label={lbl('Zip', 'alternateZip')} fullWidth size="small" value={altZip} onChange={(e) => setAltZip(e.target.value)} required={req('alternateZip')} />
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Notes ────────────────────────────────────────────────────── */}
        <SectionHeader title="Notes" />
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <FormControlLabel
              control={<Checkbox checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} size="small" />}
              label={<Typography variant="body2">Tax exempt?</Typography>}
            />
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', ml: 4, mb: 1.5 }}>
              Select if this customer should be tax exempt, this will also add a tax exempt designation to invoices and receipts.
            </Typography>

            <FormControlLabel
              control={<Checkbox checked={lateFeeExempt} onChange={(e) => setLateFeeExempt(e.target.checked)} size="small" />}
              label={<Typography variant="body2">Late fee exempt?</Typography>}
            />
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', ml: 4, mb: 2 }}>
              Select if you want to exempt the late fee for this customer.
            </Typography>

            <TextField
              label="Invoice note" fullWidth size="small" multiline rows={3}
              value={invoiceNote} onChange={(e) => setInvoiceNote(e.target.value)}
              helperText="The text here appears on this customer's non-postcard invoices."
              sx={{ mb: 2 }}
            />

            <TextField
              label="Notes" fullWidth size="small" multiline rows={3}
              value={notes} onChange={(e) => setNotes(e.target.value)}
              helperText="These notes appear at the top of the customer information."
            />
          </CardContent>
        </Card>

        {/* Footer */}
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          * Field is required for customers during an online rental, waiting list signup, or both.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Button type="submit" variant="contained" disableElevation disabled={saving}
            sx={{ bgcolor: '#4A9E8E', '&:hover': { bgcolor: '#3D8B7D' } }}>
            {saving ? 'Creating...' : 'Create Customer'}
          </Button>
          <Button onClick={() => router.push('/admin/tenants')} sx={{ color: 'primary.main' }}>
            Cancel
          </Button>
        </Box>
      </form>
    </Box>
  )
}
