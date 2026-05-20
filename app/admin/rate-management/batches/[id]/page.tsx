'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
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
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { formatMoney } from '@/lib/utils'

interface BatchDetail {
  _id: string
  createdBy: string
  createdAt: string
  status: 'submitted' | 'partially_cancelled' | 'cancelled'
  notifChannels: string[]
  unitTypeChanges: Array<{
    unitType: string
    previousPrice: number
    newPrice: number
    affectedUnitCount: number
    occupancyAtSubmit: number
    targetOccupancyAfter?: number
  }>
  rentalChanges: Array<{
    rateChangeId: string
    unitNumber: string
    currentRate: number
    proposedRate: number
    notificationDate: string
    changeDate: string
    cancelledAt?: string
  }>
}

const fmt = (s: string) => new Date(s).toLocaleString('en-US', { dateStyle: 'short' })

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/admin/rate-management/batches/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load')
      setBatch(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  async function reprintItem(rateChangeId: string) {
    try {
      const res = await fetch(`/api/admin/rate-management/batches/${id}/reprint-item`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rateChangeId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSnackbar('Reprint queued')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reprint failed')
    }
  }

  async function cancelItem(rateChangeId: string) {
    try {
      const res = await fetch(`/api/admin/rate-management/batches/${id}/cancel-item`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rateChangeId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSnackbar('Cancelled')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed')
    }
  }

  async function saveEdit(rateChangeId: string) {
    try {
      const newProposedRate = Math.round((parseFloat(editValue) || 0) * 100)
      const res = await fetch(`/api/admin/rate-management/batches/${id}/edit-item`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rateChangeId, newProposedRate }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setEditing(null)
      setSnackbar('Updated')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: 300, alignItems: 'center' }}><CircularProgress sx={{ color: '#B8914A' }} /></Box>
  }
  if (!batch) {
    return <Alert severity="error" sx={{ borderRadius: 2 }}>{error ?? 'Not found'}</Alert>
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button component={Link} href="/admin/rate-management/batches" startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}>
          Batches
        </Button>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06', flex: 1 }}>
          Batch · {fmt(batch.createdAt)}
        </Typography>
        <Chip label={batch.status.replace('_', ' ')} sx={{ textTransform: 'capitalize' }} />
      </Box>

      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary">Created by</Typography>
          <Typography sx={{ mb: 1 }}>{batch.createdBy}</Typography>
          <Typography variant="body2" color="text.secondary">Notification channels</Typography>
          <Typography>{batch.notifChannels.length > 0 ? batch.notifChannels.join(', ') : 'None'}</Typography>
        </CardContent>
      </Card>

      {batch.unitTypeChanges.length > 0 && (
        <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Unit Type Price Changes</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Unit Type</TableCell>
                    <TableCell align="right">Previous</TableCell>
                    <TableCell align="right">New</TableCell>
                    <TableCell align="right">Units affected</TableCell>
                    <TableCell align="right">Occupancy at submit</TableCell>
                    <TableCell align="right">New target occupancy</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batch.unitTypeChanges.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell>{c.unitType}</TableCell>
                      <TableCell align="right">{formatMoney(c.previousPrice)}</TableCell>
                      <TableCell align="right">{formatMoney(c.newPrice)}</TableCell>
                      <TableCell align="right">{c.affectedUnitCount}</TableCell>
                      <TableCell align="right">{c.occupancyAtSubmit.toFixed(1)}%</TableCell>
                      <TableCell align="right">{c.targetOccupancyAfter != null ? `${c.targetOccupancyAfter}%` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {batch.rentalChanges.length > 0 && (
        <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Scheduled Rental Price Changes</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Unit</TableCell>
                    <TableCell align="right">Current</TableCell>
                    <TableCell align="right">New Monthly Price</TableCell>
                    <TableCell>Notification Date</TableCell>
                    <TableCell>Change Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batch.rentalChanges.map((r) => (
                    <TableRow key={r.rateChangeId} sx={{ opacity: r.cancelledAt ? 0.5 : 1 }}>
                      <TableCell>{r.unitNumber}</TableCell>
                      <TableCell align="right">{formatMoney(r.currentRate)}</TableCell>
                      <TableCell align="right">
                        {editing === r.rateChangeId ? (
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'flex-end' }}>
                            <TextField size="small" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                              type="number" sx={{ width: 90 }} />
                            <IconButton size="small" onClick={() => saveEdit(r.rateChangeId)}><CheckIcon fontSize="small" /></IconButton>
                            <IconButton size="small" onClick={() => setEditing(null)}><CloseIcon fontSize="small" /></IconButton>
                          </Box>
                        ) : (
                          <Button size="small" disabled={!!r.cancelledAt}
                            onClick={() => { setEditing(r.rateChangeId); setEditValue((r.proposedRate / 100).toFixed(2)) }}
                            sx={{ textTransform: 'none', color: '#B8914A' }}>
                            {formatMoney(r.proposedRate)}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>{fmt(r.notificationDate)}</TableCell>
                      <TableCell>{fmt(r.changeDate)}</TableCell>
                      <TableCell>
                        {r.cancelledAt ? (
                          <Chip size="small" label="Cancelled" sx={{ bgcolor: '#FEE2E2', color: '#991B1B' }} />
                        ) : (
                          <Chip size="small" label="Scheduled" sx={{ bgcolor: '#D1FAE5', color: '#065F46' }} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {!r.cancelledAt && (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            {batch.notifChannels.includes('print') && (
                              <Button size="small" onClick={() => reprintItem(r.rateChangeId)}
                                sx={{ textTransform: 'none', color: '#5C5347' }}>
                                Reprint
                              </Button>
                            )}
                            <Button size="small" onClick={() => cancelItem(r.rateChangeId)}
                              sx={{ textTransform: 'none', color: '#991B1B' }}>
                              Cancel
                            </Button>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      <Snackbar open={!!snackbar} autoHideDuration={2500} onClose={() => setSnackbar(null)} message={snackbar} />
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 2 }}>{error}</Alert>}
    </Box>
  )
}
