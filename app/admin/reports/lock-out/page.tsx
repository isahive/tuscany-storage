'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

interface LockoutEventRow {
  _id: string
  type: 'locked_out' | 'unlocked'
  trigger: 'auto' | 'manual'
  reason?: string
  createdBy: string
  approvedAt: string | null
  approvedBy: string | null
  createdAt: string
  tenantId?: { _id: string; firstName: string; lastName: string; email: string } | null
  unitId?: { _id: string; unitNumber: string } | null
}

const TYPE_COLORS: Record<LockoutEventRow['type'], { bg: string; color: string }> = {
  locked_out: { bg: '#FEE2E2', color: '#991B1B' },
  unlocked: { bg: '#D1FAE5', color: '#065F46' },
}

const fmt = (s: string) => new Date(s).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })

export default function LockOutReportPage() {
  const [rows, setRows] = useState<LockoutEventRow[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snack, setSnack] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = filter === 'all' ? '' : `?status=${filter}`
      const res = await fetch(`/api/admin/lockout-events${qs}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setRows(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function approve(id: string) {
    try {
      const res = await fetch(`/api/admin/lockout-events/${id}/approve`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSnack('Approved')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button component={Link} href="/admin/reports" startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}>
          Reports
        </Button>
        <Typography variant="h5" sx={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 700, color: '#2C3826', flex: 1 }}>
          Lock Out Report
        </Typography>
        <ToggleButtonGroup
          size="small" value={filter} exclusive
          onChange={(_, v) => v && setFilter(v)}
        >
          <ToggleButton value="all" sx={{ textTransform: 'none' }}>All</ToggleButton>
          <ToggleButton value="pending" sx={{ textTransform: 'none' }}>Pending Approval</ToggleButton>
          <ToggleButton value="approved" sx={{ textTransform: 'none' }}>Approved</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card sx={{ border: '1px solid #E5E7EB', boxShadow: 'none', borderRadius: 2 }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: '#B8914A' }} /></Box>
          ) : rows.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">No events.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' } }}>
                    <TableCell>When</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Trigger</TableCell>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>By</TableCell>
                    <TableCell>Approval</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => {
                    const c = TYPE_COLORS[r.type]
                    return (
                      <TableRow key={r._id} hover>
                        <TableCell>{fmt(r.createdAt)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={r.type.replace('_', ' ')}
                            sx={{ bgcolor: c.bg, color: c.color, fontWeight: 600, textTransform: 'capitalize' }} />
                        </TableCell>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{r.trigger}</TableCell>
                        <TableCell>
                          {r.tenantId ? (
                            <>
                              {r.tenantId.firstName} {r.tenantId.lastName}
                              <Typography variant="caption" display="block" color="text.secondary">{r.tenantId.email}</Typography>
                            </>
                          ) : '—'}
                        </TableCell>
                        <TableCell>{r.unitId?.unitNumber ?? '—'}</TableCell>
                        <TableCell>{r.reason ?? '—'}</TableCell>
                        <TableCell>{r.createdBy}</TableCell>
                        <TableCell>
                          {r.approvedAt ? (
                            <>
                              <Chip size="small" label="Approved" sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 600 }} />
                              <Typography variant="caption" display="block" color="text.secondary">{r.approvedBy} · {fmt(r.approvedAt)}</Typography>
                            </>
                          ) : (
                            <Button size="small" variant="contained" disableElevation
                              onClick={() => approve(r._id)}
                              sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none' }}>
                              Approve
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Snackbar open={!!snack} autoHideDuration={2000} onClose={() => setSnack(null)} message={snack} />
    </Box>
  )
}
