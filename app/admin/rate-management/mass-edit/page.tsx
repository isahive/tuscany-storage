'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { formatMoney } from '@/lib/utils'

interface Lease {
  _id: string
  monthlyRate: number
  exemptFromRateManagement?: boolean
  unitId: { _id: string; unitNumber: string; type: string } | string
  tenantId: { _id: string; firstName: string; lastName: string; email: string } | string
}

interface Row extends Lease {
  selected: boolean
  newRateCents: number
  notificationDate: string
  changeDate: string
}

const UNIT_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle / Outdoor',
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Mass Edit Rental Prices — Storable's sibling to Rate Management Summary.
 * Admin hand-picks rentals + new prices instead of working from rule
 * suggestions. Submits through the same batch endpoint with source='mass_edit'
 * so the Batches page lists both flavors together.
 */
export default function MassEditPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [filter, setFilter] = useState<'all' | string>('all')
  const [channels, setChannels] = useState({ email: true, text: false, print: false })
  const [advanceNoticeDays, setAdvanceNoticeDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Pull all active leases + the global advance-notice default so the
      // notification/change dates default sensibly per row.
      const [lRes, sRes] = await Promise.all([
        fetch('/api/leases?status=active&limit=all'),
        fetch('/api/settings'),
      ])
      const [lJson, sJson] = await Promise.all([lRes.json(), sRes.json()])
      if (!lJson.success) throw new Error(lJson.error)
      const offset = sJson?.data?.rentalPriceAdvanceNoticeDays ?? 30
      setAdvanceNoticeDays(offset)

      const today = new Date()
      const change = new Date(today)
      change.setDate(change.getDate() + offset)

      const items: Row[] = (lJson.data.items ?? []).map((l: Lease) => ({
        ...l,
        selected: false,
        newRateCents: l.monthlyRate,
        notificationDate: isoDate(today),
        changeDate: isoDate(change),
      }))
      setRows(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const visibleRows = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter((r) => typeof r.unitId === 'object' && r.unitId.type === filter)
  }, [rows, filter])

  const selectedCount = rows.filter((r) => r.selected).length

  async function handleSubmit() {
    setSubmitting(true); setError(null)
    try {
      const selectedChannels = Object.entries(channels).filter(([, on]) => on).map(([k]) => k)
      const selected = rows.filter((r) => r.selected)
      if (selected.length === 0) throw new Error('Pick at least one rental.')

      const res = await fetch('/api/admin/rate-management/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'mass_edit',
          notifChannels: selectedChannels,
          unitTypeChanges: [],
          rentalChanges: selected.map((r) => ({
            leaseId: r._id,
            unitId: typeof r.unitId === 'object' ? r.unitId._id : r.unitId,
            tenantId: typeof r.tenantId === 'object' ? r.tenantId._id : r.tenantId,
            currentRate: r.monthlyRate,
            proposedRate: r.newRateCents,
            notificationDate: r.notificationDate,
            changeDate: r.changeDate,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Submit failed')
      setSavedOpen(true)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: 300, alignItems: 'center' }}><CircularProgress sx={{ color: '#B8914A' }} /></Box>
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button component={Link} href="/admin/rate-management" startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}>
          Rate Management
        </Button>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06', flex: 1 }}>
          Mass Edit Rental Prices
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
        Hand-pick rentals + set new prices. Batches submitted from here appear on the
        same <Link href="/admin/rate-management/batches" style={{ color: '#B8914A' }}>Batches page</Link>
        {' '}as rule-driven Rate Management changes.
      </Alert>

      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">Filter by unit type</Typography>
            <Select size="small" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="all">All types</MenuItem>
              {Object.entries(UNIT_TYPE_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </Select>
            <Box sx={{ flex: 1 }} />
            <Chip label={`${selectedCount} selected`} size="small" />
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Tenant</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Current</TableCell>
                  <TableCell align="right">New Rate</TableCell>
                  <TableCell>Notification</TableCell>
                  <TableCell>Change</TableCell>
                  <TableCell>Exempt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No rentals.
                  </TableCell></TableRow>
                ) : visibleRows.map((r) => {
                  const tenant = typeof r.tenantId === 'object' ? r.tenantId : null
                  const unit = typeof r.unitId === 'object' ? r.unitId : null
                  return (
                    <TableRow key={r._id} hover sx={{ opacity: r.exemptFromRateManagement ? 0.5 : 1 }}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={r.selected}
                          disabled={!!r.exemptFromRateManagement}
                          onChange={(e) =>
                            setRows((rs) => rs.map((x) => x._id === r._id ? { ...x, selected: e.target.checked } : x))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {tenant ? `${tenant.firstName} ${tenant.lastName}` : '—'}
                      </TableCell>
                      <TableCell>{unit?.unitNumber ?? '—'}</TableCell>
                      <TableCell>{unit ? (UNIT_TYPE_LABELS[unit.type] ?? unit.type) : '—'}</TableCell>
                      <TableCell align="right">{formatMoney(r.monthlyRate)}</TableCell>
                      <TableCell align="right">
                        <TextField size="small" type="number"
                          value={(r.newRateCents / 100).toFixed(2)}
                          onChange={(e) =>
                            setRows((rs) => rs.map((x) => x._id === r._id
                              ? { ...x, newRateCents: Math.round((parseFloat(e.target.value) || 0) * 100) }
                              : x))}
                          sx={{ width: 100 }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="date"
                          value={r.notificationDate}
                          onChange={(e) =>
                            setRows((rs) => rs.map((x) => x._id === r._id ? { ...x, notificationDate: e.target.value } : x))}
                          sx={{ width: 140 }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="date"
                          value={r.changeDate}
                          onChange={(e) =>
                            setRows((rs) => rs.map((x) => x._id === r._id ? { ...x, changeDate: e.target.value } : x))}
                          sx={{ width: 140 }} />
                      </TableCell>
                      <TableCell>
                        {r.exemptFromRateManagement && <Chip size="small" label="Exempt" sx={{ bgcolor: '#FEF3C7', color: '#92400E' }} />}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
        <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" fontWeight={700}>Notifications</Typography>
          <FormControlLabel control={<Checkbox checked={channels.email} onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))} />} label="Email" />
          <FormControlLabel control={<Checkbox checked={channels.text} onChange={(e) => setChannels((c) => ({ ...c, text: e.target.checked }))} />} label="Text" />
          <FormControlLabel control={<Checkbox checked={channels.print} onChange={(e) => setChannels((c) => ({ ...c, print: e.target.checked }))} />} label="Print" />
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || selectedCount === 0}
            sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600, px: 3 }}
          >
            {submitting ? <CircularProgress size={20} sx={{ color: 'white' }} /> : `Submit ${selectedCount} change(s)`}
          </Button>
        </CardContent>
      </Card>

      <Snackbar open={savedOpen} autoHideDuration={2500} onClose={() => setSavedOpen(false)} message="Batch submitted" />
    </Box>
  )
}
