'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  InputAdornment,
  Link as MuiLink,
  MenuItem,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'
import { formatMoney } from '@/lib/utils'

interface UnitItem {
  _id: string
  unitNumber: string
  size: string
  price: number
  status: string
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: '#2C3826' }}>
      {children}
    </Typography>
  )
}

export default function ReserveUnitPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [tenantName, setTenantName] = useState('')
  const [units, setUnits] = useState<UnitItem[]>([])
  const [reservationLimitDays, setReservationLimitDays] = useState(0)

  const [unitType, setUnitType] = useState('')
  const [unitId, setUnitId] = useState<'auto' | string>('auto')
  const [reservationPrice, setReservationPrice] = useState(0)
  const [desiredMoveInDate, setDesiredMoveInDate] = useState(() => new Date().toISOString().slice(0, 10))

  useSetAdminPageTitle('Reserve a Unit')

  const load = useCallback(async () => {
    try {
      const [tRes, uRes, sRes] = await Promise.all([
        fetch(`/api/tenants/${tenantId}`),
        fetch('/api/units?status=available&limit=all'),
        fetch('/api/settings'),
      ])
      const tJson = await tRes.json()
      const uJson = await uRes.json()
      const sJson = await sRes.json()

      if (tJson.success) setTenantName(`${tJson.data.firstName} ${tJson.data.lastName}`.trim())
      if (uJson.success) setUnits(uJson.data.items.filter((u: UnitItem) => u.status === 'available'))
      if (sJson.success) setReservationLimitDays(sJson.data?.reservationLimitDays ?? 0)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const unitSizes = useMemo(() => Array.from(new Set(units.map((u) => u.size))), [units])
  useEffect(() => {
    if (!unitType && unitSizes.length > 0) setUnitType(unitSizes[0])
  }, [unitSizes, unitType])

  const unitsOfType = useMemo(() => units.filter((u) => u.size === unitType), [units, unitType])
  const selectedUnit = useMemo(() => {
    if (unitId === 'auto') return unitsOfType[0] ?? null
    return units.find((u) => u._id === unitId) ?? null
  }, [unitId, unitsOfType, units])

  // Default reservation price to the unit's monthly price × 2 (typical first month + deposit
  // hold, matching the live admin default). Admin can override.
  useEffect(() => {
    if (selectedUnit) setReservationPrice(selectedUnit.price * 2)
  }, [selectedUnit])

  async function handleSubmit() {
    if (!selectedUnit) { setError('Select a unit first'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/reserve-unit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: selectedUnit._id,
          reservationPrice,
          desiredMoveInDate,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')
      setSuccess('Reservation created')
      router.push(`/admin/tenants/${tenantId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header — breadcrumb is rendered by the admin layout's app bar. */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ color: '#D97757', fontWeight: 700 }}>
          Reserve a Unit
        </Typography>
        <Button
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          size="small"
          sx={{ bgcolor: '#B8BCC4', color: 'white', textTransform: 'none', '&:hover': { bgcolor: '#A0A4AC' } }}
        >
          Return to Customer
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card variant="outlined" sx={{ maxWidth: 560, p: 3, borderColor: '#E5E1D8' }}>
        <FieldLabel>Unit Type</FieldLabel>
        <TextField
          select fullWidth size="small"
          value={unitType}
          onChange={(e) => { setUnitType(e.target.value); setUnitId('auto') }}
          sx={{ mb: 2 }}
        >
          {unitSizes.length === 0 ? (
            <MenuItem value="">No available units</MenuItem>
          ) : (
            unitSizes.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)
          )}
        </TextField>

        <FieldLabel>Unit</FieldLabel>
        <TextField
          select fullWidth size="small"
          value={unitId}
          onChange={(e) => setUnitId(e.target.value as any)}
          sx={{ mb: 2 }}
        >
          <MenuItem value="auto">Automatically Select</MenuItem>
          {unitsOfType.map((u) => <MenuItem key={u._id} value={u._id}>{u.unitNumber}</MenuItem>)}
        </TextField>

        <FieldLabel>Reservation Price</FieldLabel>
        <TextField
          fullWidth size="small" type="number"
          value={reservationPrice / 100}
          onChange={(e) => setReservationPrice(Math.round(parseFloat(e.target.value || '0') * 100))}
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
            sx: { bgcolor: '#F1EEE8' },
          }}
          sx={{ mb: 2 }}
        />

        <FieldLabel>Desired Move-in Date</FieldLabel>
        <TextField
          type="date" fullWidth size="small"
          value={desiredMoveInDate}
          onChange={(e) => setDesiredMoveInDate(e.target.value)}
          sx={{ mb: 1 }}
        />
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 3 }}>
          The{' '}
          <MuiLink href="/admin/settings/rental" sx={{ color: '#3B82F6' }}>
            Reservation Limit
          </MuiLink>{' '}
          for customers is set to {reservationLimitDays} days in the future.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving || !selectedUnit}
            disableElevation
            sx={{ bgcolor: '#3B82F6', textTransform: 'none', px: 3, '&:hover': { bgcolor: '#2563EB' } }}
          >
            {saving ? 'Reserving…' : 'Create Reservation'}
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
      </Card>

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
