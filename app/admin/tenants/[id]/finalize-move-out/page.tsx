'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'

type UnitStatusAfter = 'available' | 'maintenance' | 'reserved' | 'unavailable'

const UNIT_STATUS_OPTIONS: Array<{ value: UnitStatusAfter; label: string }> = [
  { value: 'available',   label: 'Available' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'reserved',    label: 'Reserved' },
  { value: 'unavailable', label: 'Unavailable' },
]

function FinalizeMoveOutInner() {
  const router = useRouter()
  const params = useParams()
  const search = useSearchParams()
  const tenantId = params.id as string
  const moveOutId = search.get('moveOutId')

  const [unitNumber, setUnitNumber] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [unitStatus, setUnitStatus] = useState<UnitStatusAfter>('available')
  const [archive, setArchive] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!moveOutId) {
      setError('Missing move-out request reference.')
      setLoading(false)
      return
    }
    fetch(`/api/move-out?tenantId=${tenantId}&status=pending`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return
        const match = (j.data as Array<{ _id: string; unitId?: { unitNumber?: string } }>).find(
          (r) => r._id === moveOutId,
        )
        if (match?.unitId?.unitNumber) setUnitNumber(match.unitId.unitNumber)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [moveOutId, tenantId])

  async function handleFinalize() {
    if (!moveOutId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/move-out/${moveOutId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitStatusAfter: unitStatus, archiveCustomer: archive }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to finalize')
      router.push(`/admin/tenants/${tenantId}/move-out-receipt?moveOutId=${moveOutId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#9A3412', mb: 1 }}>
        Finalize Move Out{unitNumber ? ` of Unit ${unitNumber}` : ''}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, color: 'text.secondary', fontSize: 14 }}>
        <Link href="/admin" style={{ color: '#3B82F6' }}>Home</Link>
        <span>/</span>
        <Link href={`/admin/tenants`} style={{ color: '#3B82F6' }}>Customers</Link>
        <span>/</span>
        <Link href={`/admin/tenants/${tenantId}`} style={{ color: '#3B82F6' }}>Customer</Link>
        <span>/</span>
        <span>Finalize Move Out</span>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 1, p: 3, mb: 3, bgcolor: '#FFFFFF' }}>
        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel id="unit-status-label">Unit Status</InputLabel>
          <Select
            labelId="unit-status-label"
            label="Unit Status"
            value={unitStatus}
            onChange={(e) => setUnitStatus(e.target.value as UnitStatusAfter)}
          >
            {UNIT_STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Select what you would like the status of {unitNumber ? `Unit ${unitNumber}` : 'this unit'} to be after this move out is complete.
        </Typography>
      </Box>

      <FormControlLabel
        control={
          <Checkbox
            checked={archive}
            onChange={(e) => setArchive(e.target.checked)}
            size="small"
          />
        }
        label={<Typography variant="body2">Archive Customer After Move Out</Typography>}
        sx={{ mb: 3 }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          disabled={submitting}
          onClick={handleFinalize}
          sx={{ bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' }, textTransform: 'none', fontWeight: 600 }}
          startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {submitting ? 'Finalizing…' : 'Finalize Move Out'}
        </Button>
        <Link
          href={`/admin/tenants/${tenantId}`}
          style={{ color: '#3B82F6', fontSize: 14 }}
        >
          Finalize Later
        </Link>
      </Box>
    </Box>
  )
}

export default function FinalizeMoveOutPage() {
  return (
    <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}>
      <FinalizeMoveOutInner />
    </Suspense>
  )
}
