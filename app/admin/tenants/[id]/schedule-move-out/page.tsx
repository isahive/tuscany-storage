'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material'

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function ScheduleMoveOutInner() {
  const router = useRouter()
  const params = useParams()
  const search = useSearchParams()
  const tenantId = params.id as string
  const leaseId = search.get('leaseId')

  const [unitNumber, setUnitNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [moveOutDate, setMoveOutDate] = useState(todayISO())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!leaseId) {
      setError('Missing lease reference.')
      setLoading(false)
      return
    }
    fetch(`/api/leases?tenantId=${tenantId}&limit=50`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return
        const match = (j.data?.items as Array<{ _id: string; unitId?: { unitNumber?: string } | string }>)
          .find((l) => l._id === leaseId)
        if (match && typeof match.unitId === 'object' && match.unitId?.unitNumber) {
          setUnitNumber(match.unitId.unitNumber)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [leaseId, tenantId])

  async function handleSubmit() {
    if (!leaseId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/move-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          leaseId,
          requestedMoveOutDate: new Date(`${moveOutDate}T12:00:00`).toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to schedule move-out.')
      router.push(`/admin/tenants/${tenantId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule move-out.')
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
      <Typography variant="h5" sx={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 700, color: '#9A3412', mb: 1 }}>
        Schedule Move Out{unitNumber ? ` of Unit ${unitNumber}` : ''}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, color: 'text.secondary', fontSize: 14 }}>
        <Link href="/admin" style={{ color: '#3B82F6' }}>Home</Link>
        <span>/</span>
        <Link href={`/admin/tenants`} style={{ color: '#3B82F6' }}>Customers</Link>
        <span>/</span>
        <Link href={`/admin/tenants/${tenantId}`} style={{ color: '#3B82F6' }}>Customer</Link>
        <span>/</span>
        <span>Schedule Move Out</span>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 1, p: 3, mb: 3, bgcolor: '#FFFFFF' }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          You can schedule a move out for today or any date in the future.
        </Typography>
        <TextField
          type="date"
          label="Requested move-out date"
          InputLabelProps={{ shrink: true }}
          size="small"
          value={moveOutDate}
          onChange={(e) => setMoveOutDate(e.target.value)}
          inputProps={{ min: todayISO() }}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          disabled={submitting || !moveOutDate}
          onClick={handleSubmit}
          sx={{ bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' }, textTransform: 'none', fontWeight: 600 }}
          startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {submitting ? 'Scheduling…' : 'Schedule Move Out'}
        </Button>
        <Link
          href={`/admin/tenants/${tenantId}`}
          style={{ color: '#3B82F6', fontSize: 14 }}
        >
          Cancel
        </Link>
      </Box>
    </Box>
  )
}

export default function ScheduleMoveOutPage() {
  return (
    <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}>
      <ScheduleMoveOutInner />
    </Suspense>
  )
}
