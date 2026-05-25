'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Card,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputAdornment,
  Link as MuiLink,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

const BTN_PRIMARY = '#8CA87C'
const BTN_PRIMARY_HOVER = '#7E9770'

const CATEGORIES = [
  'Rent',
  'Balance Forward',
  'Returned check fee',
  'Cut Lock',
  'Late Fee',
  'Certified Letter',
  'Advertisement Fee',
  'Auction Fee',
]

function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export default function NewRecurringFeePage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [tenantName, setTenantName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Form
  const [category, setCategory] = useState<string>('')
  const [customCategory, setCustomCategory] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [interval, setIntervalVal] = useState<'monthly' | 'yearly'>('monthly')
  const [amount, setAmount] = useState('')
  const [taxRate, setTaxRate] = useState<'none'>('none') // only one option per spec
  const [chargeOnDueDate, setChargeOnDueDate] = useState(true)
  const [description, setDescription] = useState('')

  useSetAdminPageTitle('New Recurring Fee')

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/tenants/${tenantId}`)
        const json = await res.json()
        if (json.success) setTenantName(`${json.data.firstName} ${json.data.lastName}`)
      } finally {
        setLoading(false)
      }
    })()
  }, [tenantId])

  async function handleSubmit() {
    const amt = Math.round(parseFloat(amount || '0') * 100)
    if (!amt || amt <= 0) {
      setToast('Amount must be greater than $0.')
      return
    }
    if (!category && !customCategory.trim()) {
      setToast('Pick a category or enter a custom one.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/tenants/${tenantId}/recurring-fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          customCategory: customCategory.trim(),
          startDate: new Date(startDate).toISOString(),
          interval,
          amount: amt,
          taxRate: 0,
          chargeOnDueDate,
          description,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setToast(json.error || 'Failed to create fee')
        return
      }
      router.push(`/admin/tenants/${tenantId}/recurring-fees`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header — admin layout already renders the breadcrumb. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/admin/tenants/${tenantId}/recurring-fees`)}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Back
        </Button>
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: '#2C3826', fontFamily: 'var(--font-outfit), system-ui, sans-serif', flex: 1 }}
        >
          New Recurring Fee{tenantName ? ` — ${tenantName}` : ''}
        </Typography>
      </Box>

      <Card sx={{ p: 3, maxWidth: 720 }}>
        {/* Category */}
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Category</Typography>
        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <Select
            value={category}
            displayEmpty
            onChange={(e) => setCategory(e.target.value as string)}
          >
            <MenuItem value="">Use a manual fee category</MenuItem>
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          fullWidth size="small"
          placeholder="or use a custom category"
          value={customCategory}
          onChange={(e) => setCustomCategory(e.target.value)}
          sx={{ mb: 2.5 }}
        />

        {/* Start Date */}
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Start Date</Typography>
        <TextField
          type="date"
          fullWidth size="small"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          sx={{ mb: 0.5 }}
          InputLabelProps={{ shrink: true }}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2.5 }}>
          This recurring fee will be invoiced using the{' '}
          <MuiLink href="/admin/settings" sx={{ color: BTN_PRIMARY }}>Billing Period</MuiLink> (7 days)
        </Typography>

        {/* Interval */}
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Interval</Typography>
        <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
          <Select
            value={interval}
            onChange={(e) => setIntervalVal(e.target.value as 'monthly' | 'yearly')}
          >
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="yearly">Yearly</MenuItem>
          </Select>
        </FormControl>

        {/* Amount */}
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Amount</Typography>
        <TextField
          size="small"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          sx={{ mb: 2.5, width: 200 }}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          inputProps={{ inputMode: 'decimal' }}
        />

        {/* Tax Rate — only "Don't Charge Tax" per spec */}
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Tax Rate</Typography>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <Select value={taxRate} onChange={(e) => setTaxRate(e.target.value as 'none')}>
            <MenuItem value="none">Don&apos;t Charge Tax</MenuItem>
          </Select>
        </FormControl>

        {/* Charge active payment account */}
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={chargeOnDueDate}
              onChange={(e) => setChargeOnDueDate(e.target.checked)}
            />
          }
          label={
            <Typography variant="body2">
              Charge active payment account on the due date if start date is after today
            </Typography>
          }
          sx={{ mb: 2, ml: -1 }}
        />

        {/* Description */}
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Description</Typography>
        <TextField
          multiline rows={4} fullWidth size="small"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ mb: 2.5 }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="contained"
            disableElevation
            disabled={saving}
            onClick={handleSubmit}
            sx={{
              bgcolor: BTN_PRIMARY, color: 'white', textTransform: 'none', fontWeight: 600,
              '&:hover': { bgcolor: BTN_PRIMARY_HOVER },
            }}
          >
            {saving ? 'Saving…' : 'Create Recurring Fee'}
          </Button>
          <MuiLink
            component="button"
            variant="body2"
            onClick={() => router.push(`/admin/tenants/${tenantId}/recurring-fees`)}
            sx={{ color: BTN_PRIMARY }}
          >
            Cancel
          </MuiLink>
        </Box>
      </Card>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
