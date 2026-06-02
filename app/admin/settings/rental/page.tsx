'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Snackbar,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'

type BillingCycleAnchor = 'first_of_month' | 'signup_day' | 'custom_day'
type ProrationModel =
  | 'none'
  | 'custom'
  | 'first_month_full_prorate_now'
  | 'first_month_full_then_prorate'
  | 'prorate_first_month'
  | 'prorate_both'
type ProrationDaysBasis = 'actual_days_in_month' | 'thirty_day_month'

interface FormState {
  // Billing Cycle
  billingCycleAnchor: BillingCycleAnchor
  billingCycleCustomDay: number
  // Billing
  billingDaysBeforeDue: number
  // Proration
  prorationModel: ProrationModel
  prorationDaysBasis: ProrationDaysBasis
  // Reservations
  enableReservations: boolean
  reservationLimitDays: number
  unitTypeReservationFees: Array<{ unitType: string; amount: number }>
  // Customer permissions
  customersCanEditProfile: boolean
  customersCanEditBilling: boolean
  customersCanScheduleMoveOuts: boolean
  // New renter instructions
  newRenterInstructions: string
  // Lockout approval
  lockoutRequireApprovalAuto: boolean
  lockoutRequireApprovalManual: boolean
}

const DEFAULTS: FormState = {
  billingCycleAnchor: 'first_of_month',
  billingCycleCustomDay: 1,
  billingDaysBeforeDue: 7,
  prorationModel: 'first_month_full_then_prorate',
  prorationDaysBasis: 'actual_days_in_month',
  enableReservations: false,
  reservationLimitDays: 0,
  unitTypeReservationFees: [],
  customersCanEditProfile: true,
  customersCanEditBilling: true,
  customersCanScheduleMoveOuts: true,
  newRenterInstructions: '',
  lockoutRequireApprovalAuto: false,
  lockoutRequireApprovalManual: false,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#B8914A', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 2 }}>
      {children}
    </Typography>
  )
}

function SettingSwitch({
  label, hint, checked, onChange,
}: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <FormControlLabel
        control={
          <Switch
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            size="small"
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: '#B8914A' },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#B8914A' },
            }}
          />
        }
        label={<Typography variant="body2" sx={{ fontWeight: 500, color: '#2C3826' }}>{label}</Typography>}
      />
      {hint && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', ml: 4.5, mt: -0.5 }}>
          {hint}
        </Typography>
      )}
    </Box>
  )
}

function NumberField({ label, hint, value, onChange, min = 0, max }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: '#2C3826', mb: 0.5 }}>{label}</Typography>
      <TextField
        type="number"
        size="small"
        value={value}
        onChange={(e) => {
          const raw = parseInt(e.target.value, 10) || 0
          let next = Math.max(min, raw)
          if (typeof max === 'number') next = Math.min(max, next)
          onChange(next)
        }}
        inputProps={{ min, ...(typeof max === 'number' ? { max } : {}) }}
        sx={{
          width: 120,
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: '#E5E7EB' },
            '&:hover fieldset': { borderColor: '#B8914A' },
            '&.Mui-focused fieldset': { borderColor: '#B8914A' },
          },
        }}
      />
      {hint && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>{hint}</Typography>
      )}
    </Box>
  )
}

function RadioGroupField<T extends string>({
  label, hint, value, onChange, options,
}: {
  label: string
  hint?: string
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; hint?: string }>
}) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: '#2C3826', mb: 0.5 }}>{label}</Typography>
      {hint && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>{hint}</Typography>
      )}
      <RadioGroup value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((opt) => (
          <Box key={opt.value} sx={{ mb: 0.5 }}>
            <FormControlLabel
              value={opt.value}
              control={
                <Radio
                  size="small"
                  sx={{
                    color: '#E5E7EB',
                    '&.Mui-checked': { color: '#B8914A' },
                  }}
                />
              }
              label={<Typography variant="body2" sx={{ fontWeight: 500, color: '#2C3826' }}>{opt.label}</Typography>}
            />
            {opt.hint && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', ml: 4, mt: -0.5 }}>
                {opt.hint}
              </Typography>
            )}
          </Box>
        ))}
      </RadioGroup>
    </Box>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RentalSettingsPage() {
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
            billingCycleAnchor: d.billingCycleAnchor ?? DEFAULTS.billingCycleAnchor,
            billingCycleCustomDay: d.billingCycleCustomDay ?? DEFAULTS.billingCycleCustomDay,
            billingDaysBeforeDue: d.billingDaysBeforeDue ?? 7,
            prorationModel: d.prorationModel ?? DEFAULTS.prorationModel,
            prorationDaysBasis: d.prorationDaysBasis ?? DEFAULTS.prorationDaysBasis,
            enableReservations: d.enableReservations ?? false,
            reservationLimitDays: d.reservationLimitDays ?? 0,
            unitTypeReservationFees: Array.isArray(d.unitTypeReservationFees) ? d.unitTypeReservationFees : [],
            customersCanEditProfile: d.customersCanEditProfile ?? true,
            customersCanEditBilling: d.customersCanEditBilling ?? true,
            customersCanScheduleMoveOuts: d.customersCanScheduleMoveOuts ?? true,
            newRenterInstructions: d.newRenterInstructions ?? '',
            lockoutRequireApprovalAuto: d.lockoutRequireApprovalAuto ?? false,
            lockoutRequireApprovalManual: d.lockoutRequireApprovalManual ?? false,
          }
          setForm(loaded)
          setSavedForm(loaded)
        }
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  function setBool(field: keyof FormState, value: boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }
  function setNum(field: keyof FormState, value: number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }
  function setStr(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }
  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm)

  // Confirmation state for billing-anchor changes — switching the anchor
  // mass-updates billingDay on every active lease, so we surface the impact
  // before the admin commits.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmPreview, setConfirmPreview] = useState<{ scanned: number; wouldChange: number } | null>(null)

  const billingAnchorChanged =
    form.billingCycleAnchor !== savedForm.billingCycleAnchor
    || (form.billingCycleAnchor === 'custom_day'
      && form.billingCycleCustomDay !== savedForm.billingCycleCustomDay)

  async function attemptSave() {
    if (!billingAnchorChanged) {
      await persistSave()
      return
    }
    // Fetch impact preview before showing the confirm dialog. If the preview
    // call fails we still let the admin save — failing closed would leave
    // them unable to save other unrelated edits.
    setConfirmLoading(true)
    setConfirmPreview(null)
    try {
      const params = new URLSearchParams({
        anchor: form.billingCycleAnchor,
        customDay: String(form.billingCycleCustomDay),
      })
      const res = await fetch(`/api/admin/billing-day-preview?${params}`)
      const json = await res.json()
      if (res.ok && json?.success) {
        setConfirmPreview(json.data as { scanned: number; wouldChange: number })
      } else {
        setConfirmPreview({ scanned: 0, wouldChange: 0 })
      }
    } catch {
      setConfirmPreview({ scanned: 0, wouldChange: 0 })
    } finally {
      setConfirmLoading(false)
      setConfirmOpen(true)
    }
  }

  async function persistSave() {
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
      setConfirmOpen(false)
    }
  }

  function anchorLabel(a: BillingCycleAnchor): string {
    switch (a) {
      case 'first_of_month': return '1st of the month'
      case 'custom_day': return `Day ${form.billingCycleCustomDay} of the month`
      case 'signup_day': default: return 'Each tenant\u2019s signup day'
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          component={Link}
          href="/admin/settings"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}
        >
          Setup
        </Button>
        <Typography variant="h5" sx={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 700, color: '#2C3826', flex: 1 }}>
          Rental Settings
        </Typography>
        <Button
          variant="contained"
          startIcon={saving || confirmLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SaveIcon />}
          onClick={attemptSave}
          disabled={saving || confirmLoading || !isDirty}
          sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, '&.Mui-disabled': { bgcolor: '#D4B87A', color: 'white' }, textTransform: 'none', fontWeight: 600, px: 2.5 }}
        >
          {saving ? 'Saving…' : confirmLoading ? 'Checking…' : 'Save'}
        </Button>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}

      <Box sx={{ maxWidth: 680, bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: 2, p: 3 }}>

        {/* Billing Cycle */}
        <SectionHeading>Billing Cycle</SectionHeading>
        <RadioGroupField<BillingCycleAnchor>
          label="When does the billing cycle start?"
          value={form.billingCycleAnchor}
          onChange={(v) => setField('billingCycleAnchor', v)}
          options={[
            { value: 'first_of_month', label: '1st of every month', hint: 'Recommended — every tenant billed on the same calendar day.' },
            { value: 'signup_day',     label: 'Day of the month tenant signed up' },
            { value: 'custom_day',     label: 'Specific day of the month' },
          ]}
        />
        {form.billingCycleAnchor === 'custom_day' && (
          <NumberField
            label="Day of month (1–28)"
            hint="Capped at 28 to keep cycles consistent across all months."
            value={form.billingCycleCustomDay}
            onChange={(v) => setNum('billingCycleCustomDay', v)}
            min={1}
            max={28}
          />
        )}

        <Divider sx={{ my: 3, borderColor: '#E5E7EB' }} />

        {/* Billing */}
        <SectionHeading>Billing Period</SectionHeading>
        <NumberField
          label="Days prior to due date"
          hint="Billing line items will be generated this many days before the due date."
          value={form.billingDaysBeforeDue}
          onChange={(v) => setNum('billingDaysBeforeDue', v)}
        />

        <Divider sx={{ my: 3, borderColor: '#E5E7EB' }} />

        {/* Proration */}
        <SectionHeading>Proration</SectionHeading>
        <RadioGroupField<ProrationModel>
          label="How are partial months handled?"
          value={form.prorationModel}
          onChange={(v) => setField('prorationModel', v)}
          options={[
            { value: 'none',                            label: 'No Prorating' },
            { value: 'custom',                          label: 'Custom Prorating', hint: 'Admin enters a custom first-charge amount per rental.' },
            { value: 'first_month_full_prorate_now',    label: 'Bill for first full month, Prorate second month billed now' },
            { value: 'first_month_full_then_prorate',   label: 'Bill for first full month, Prorate second month billed later', hint: 'Industry standard — matches Storable behavior.' },
            { value: 'prorate_first_month',             label: 'Prorate this month and bill full billing cycle starting next month' },
            { value: 'prorate_both',                    label: 'Prorate this month and bill now for the first billing cycle' },
          ]}
        />
        <RadioGroupField<ProrationDaysBasis>
          label="How are prorated days calculated?"
          value={form.prorationDaysBasis}
          onChange={(v) => setField('prorationDaysBasis', v)}
          options={[
            { value: 'actual_days_in_month', label: 'Actual days in the month (28–31)' },
            { value: 'thirty_day_month',     label: '30-day month (banking method)' },
          ]}
        />

        <Divider sx={{ my: 3, borderColor: '#E5E7EB' }} />

        {/* Reservations */}
        <SectionHeading>Reservations</SectionHeading>
        <SettingSwitch label="Enable reservations" checked={form.enableReservations} onChange={(v) => setBool('enableReservations', v)} />
        {form.enableReservations && (
          <>
            <NumberField
              label="Days in the future a customer reservation is allowed"
              hint="Set to 0 for no limit."
              value={form.reservationLimitDays}
              onChange={(v) => setNum('reservationLimitDays', v)}
            />
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#2C3826', mb: 0.5 }}>
                Reservation fee per Unit Type
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Charged when a customer reserves a unit. Credited back on the first rental invoice.
                Leave a row at $0 to disable the reservation CTA for that unit type.
              </Typography>
              {(['standard', 'climate_controlled', 'drive_up', 'vehicle_outdoor'] as const).map((t) => {
                const existing = form.unitTypeReservationFees.find((f) => f.unitType === t)
                const label = ({
                  standard: 'Standard',
                  climate_controlled: 'Climate Controlled',
                  drive_up: 'Drive-Up',
                  vehicle_outdoor: 'Vehicle / Outdoor',
                } as const)[t]
                return (
                  <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Typography variant="body2" sx={{ width: 180 }}>{label}</Typography>
                    <TextField
                      type="number"
                      size="small"
                      value={existing ? (existing.amount / 100).toFixed(2) : '0.00'}
                      onChange={(e) => {
                        const cents = Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100))
                        setForm((prev) => {
                          const next = prev.unitTypeReservationFees.filter((f) => f.unitType !== t)
                          if (cents > 0) next.push({ unitType: t, amount: cents })
                          return { ...prev, unitTypeReservationFees: next }
                        })
                      }}
                      InputProps={{ startAdornment: '$' }}
                      sx={{ width: 120 }}
                    />
                  </Box>
                )
              })}
            </Box>
          </>
        )}

        <Divider sx={{ my: 3, borderColor: '#E5E7EB' }} />

        {/* Customer permissions */}
        <SectionHeading>Customer Permissions</SectionHeading>
        <SettingSwitch label="Customers Can Edit Profile Information" checked={form.customersCanEditProfile} onChange={(v) => setBool('customersCanEditProfile', v)} />
        <SettingSwitch label="Customers Can Edit Billing Information" checked={form.customersCanEditBilling} onChange={(v) => setBool('customersCanEditBilling', v)} />
        <SettingSwitch
          label="Customers Can Schedule Move Outs"
          checked={form.customersCanScheduleMoveOuts}
          onChange={(v) => setBool('customersCanScheduleMoveOuts', v)}
        />

        <Divider sx={{ my: 3, borderColor: '#E5E7EB' }} />

        {/* New renter instructions */}
        <SectionHeading>New Renter Instructions</SectionHeading>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Instructions displayed on the New Renter Instructions page in the customer portal.
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={4}
          value={form.newRenterInstructions}
          onChange={(e) => setStr('newRenterInstructions', e.target.value)}
          sx={{
            mb: 1,
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: '#E5E7EB' },
              '&:hover fieldset': { borderColor: '#B8914A' },
              '&.Mui-focused fieldset': { borderColor: '#B8914A' },
            },
          }}
        />

        <Divider sx={{ my: 3, borderColor: '#E5E7EB' }} />

        {/* Lockout approval */}
        <SectionHeading>Lockout Approval</SectionHeading>
        <SettingSwitch
          label="Require approval for automatic lockout removal"
          hint="When a locked out customer pays their entire past-due balance, the lockout will be automatically removed — but they stay on the Lockout Report until manually approved here."
          checked={form.lockoutRequireApprovalAuto}
          onChange={(v) => setBool('lockoutRequireApprovalAuto', v)}
        />
        <SettingSwitch
          label="Require approval for manual lockout removal"
          hint="When a manager manually removes a lockout, it will stay on the Lockout Report until approved."
          checked={form.lockoutRequireApprovalManual}
          onChange={(v) => setBool('lockoutRequireApprovalManual', v)}
        />

      </Box>

      <Snackbar open={savedOpen} autoHideDuration={3000} onClose={() => setSavedOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSavedOpen(false)} severity="success" variant="filled" sx={{ bgcolor: '#B8914A', color: 'white', fontWeight: 500, '& .MuiAlert-icon': { color: 'white' } }}>
          Settings saved
        </Alert>
      </Snackbar>

      <Dialog
        open={confirmOpen}
        onClose={() => !saving && setConfirmOpen(false)}
        aria-labelledby="confirm-billing-anchor-title"
      >
        <DialogTitle id="confirm-billing-anchor-title" sx={{ fontWeight: 700 }}>
          Update billing day for existing leases?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            You are switching the billing cycle anchor to{' '}
            <b>{anchorLabel(form.billingCycleAnchor)}</b>. This will mass-update
            the billing day on every active lease that doesn&rsquo;t already
            match the new rule.
          </DialogContentText>
          {confirmPreview && (
            <Box sx={{ bgcolor: '#FAFAF7', border: '1px solid #E5E7EB', borderRadius: 1.5, p: 1.5, mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Impact preview
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Active leases scanned: <b>{confirmPreview.scanned}</b>
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Leases that will change: <b>{confirmPreview.wouldChange}</b>
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Leases already aligned: <b>{confirmPreview.scanned - confirmPreview.wouldChange}</b>
              </Typography>
            </Box>
          )}
          <DialogContentText variant="body2" sx={{ color: 'text.secondary' }}>
            Tenants with autopay may see their next charge shift by a few days.
            We recommend running this just after a billing cycle finishes so no
            invoices are mid-flight.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            disabled={saving}
            sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={persistSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : undefined}
            sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}
          >
            {saving ? 'Saving…' : 'Confirm & save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
