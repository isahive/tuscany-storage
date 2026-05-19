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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

interface Batch {
  _id: string
  createdBy: string
  createdAt: string
  status: 'submitted' | 'partially_cancelled' | 'cancelled'
  notifChannels: string[]
  unitTypeChanges: Array<{ unitType: string; affectedUnitCount: number; newPrice: number; previousPrice: number }>
  rentalChanges: Array<{ rateChangeId: string; cancelledAt?: string }>
}

const STATUS_COLORS: Record<Batch['status'], { bg: string; color: string }> = {
  submitted: { bg: '#D1FAE5', color: '#065F46' },
  partially_cancelled: { bg: '#FEF3C7', color: '#92400E' },
  cancelled: { bg: '#FEE2E2', color: '#991B1B' },
}

const fmtDate = (s: string) => new Date(s).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })

export default function RateManagementBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rate-management/batches')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load')
      setBatches(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button component={Link} href="/admin/rate-management" startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}>
          Rate Management
        </Button>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06', flex: 1 }}>
          Batches
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
        <CardContent sx={{ p: 0 }}>
          {batches.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No batches yet.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Submitted</TableCell>
                    <TableCell>By</TableCell>
                    <TableCell>Channels</TableCell>
                    <TableCell align="right">Unit Types</TableCell>
                    <TableCell align="right">Rentals</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batches.map((b) => {
                    const live = b.rentalChanges.filter((r) => !r.cancelledAt).length
                    const color = STATUS_COLORS[b.status]
                    return (
                      <TableRow key={b._id} hover sx={{ cursor: 'pointer' }} component={Link as any} href={`/admin/rate-management/batches/${b._id}`}>
                        <TableCell>{fmtDate(b.createdAt)}</TableCell>
                        <TableCell>{b.createdBy}</TableCell>
                        <TableCell>{b.notifChannels.length > 0 ? b.notifChannels.join(', ') : '—'}</TableCell>
                        <TableCell align="right">{b.unitTypeChanges.length}</TableCell>
                        <TableCell align="right">{live} / {b.rentalChanges.length}</TableCell>
                        <TableCell>
                          <Chip size="small" label={b.status.replace('_', ' ')} sx={{ bgcolor: color.bg, color: color.color, textTransform: 'capitalize' }} />
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
    </Box>
  )
}
