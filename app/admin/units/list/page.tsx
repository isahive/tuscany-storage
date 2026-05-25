'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PrintIcon from '@mui/icons-material/Print'
import DownloadIcon from '@mui/icons-material/Download'
import { formatMoney } from '@/lib/utils'
import {
  DISPLAY_STATUS_COLORS,
  DISPLAY_STATUS_LABELS,
  type UnitDisplayStatus,
} from '@/lib/unitStatus'

interface Row {
  _id: string
  unitNumber: string
  size: string
  type: string
  rawStatus: string
  displayStatus: UnitDisplayStatus
  tenantId: string | null
  tenantName: string | null
  tenantPhone: string | null
  tenantEmail: string | null
  tenantBalance: number
}

const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle / Outdoor',
}

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'available', label: 'Available' },
  { value: 'rented', label: 'Rented' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'late', label: 'Late' },
  { value: 'locked_out', label: 'Locked Out' },
  { value: 'pre_lien', label: 'Pre-Lien' },
  { value: 'lien', label: 'Lien' },
  { value: 'auction', label: 'Auction' },
  { value: 'moving_out', label: 'Moving Out' },
  { value: 'maintenance', label: 'Maintenance' },
]

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(rows: Row[]) {
  const header = ['Unit', 'Status', 'Type', 'Customer', 'Phone', 'Email', 'Balance']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([
      csvEscape(r.unitNumber),
      csvEscape(DISPLAY_STATUS_LABELS[r.displayStatus] ?? r.rawStatus),
      csvEscape(TYPE_LABELS[r.type] ?? r.type),
      csvEscape(r.tenantName ?? ''),
      csvEscape(r.tenantPhone ?? ''),
      csvEscape(r.tenantEmail ?? ''),
      csvEscape((r.tenantBalance / 100).toFixed(2)),
    ].join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `units-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function UnitListViewPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`
      const res = await fetch(`/api/admin/units/list${qs}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setRows(json.data.rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  return (
    <Box className="unit-list-view">
      {/* Print stylesheet — hide nav/filter/buttons, drop colors. */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .unit-list-view .no-print { display: none !important; }
          .unit-list-view .MuiCard-root { box-shadow: none !important; border: none !important; }
          .unit-list-view table { font-size: 11px; }
        }
      `}</style>

      <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button component={Link} href="/admin/units" startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}>
          Units
        </Button>
        <Typography variant="h5" sx={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 700, color: '#2C3826', flex: 1 }}>
          Unit List View
        </Typography>
        <Button size="small" startIcon={<PrintIcon />}
          onClick={() => window.print()}
          sx={{ textTransform: 'none', color: '#5C5347' }}>
          Print
        </Button>
        <Button size="small" startIcon={<DownloadIcon />}
          onClick={() => downloadCsv(rows)}
          sx={{ textTransform: 'none', color: '#5C5347' }}>
          Download CSV
        </Button>
      </Box>

      <Card sx={{ border: '1px solid #E5E7EB', boxShadow: 'none', borderRadius: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderBottom: '1px solid #E5E7EB' }}>
            <Typography variant="body2" color="text.secondary">Filter by status</Typography>
            <Select
              size="small"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
            <Box sx={{ flex: 1 }} />
            <Chip size="small" label={`${rows.length} unit${rows.length === 1 ? '' : 's'}`} />
          </Box>

          {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: '#B8914A' }} /></Box>
          ) : rows.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">No units match this filter.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' } }}>
                    <TableCell>Unit #</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => {
                    const color = DISPLAY_STATUS_COLORS[r.displayStatus] ?? { bg: '#F3F4F6', text: '#374151' }
                    return (
                      <TableRow
                        key={r._id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/admin/units/${r._id}`)}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>{r.unitNumber}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={DISPLAY_STATUS_LABELS[r.displayStatus] ?? r.rawStatus}
                            sx={{ bgcolor: color.bg, color: color.text, fontWeight: 600, textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>{TYPE_LABELS[r.type] ?? r.type}</TableCell>
                        <TableCell>
                          {r.tenantName ? (
                            <Link
                              href={`/admin/tenants/${r.tenantId}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#3E5DAA' }}
                            >
                              {r.tenantName}
                            </Link>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>{r.tenantPhone ?? '—'}</TableCell>
                        <TableCell>{r.tenantEmail ?? '—'}</TableCell>
                        <TableCell align="right">
                          {r.tenantId
                            ? formatMoney(r.tenantBalance)
                            : <Typography variant="body2" color="text.secondary">—</Typography>}
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
