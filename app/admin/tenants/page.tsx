'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/utils'
import type { TenantStatus } from '@/types'
import { TENANT_GROUPS, type TenantGroupId } from '@/lib/tenantGroups'

// ── Row type ─────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  cellPhone: string
  status: TenantStatus
  balance: number
  rentals: string[]      // unit numbers
}

// ── CSV helpers ──────────────────────────────────────────────────────────────

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatBalanceForExport(cents: number): string {
  const dollars = (cents / 100).toFixed(2)
  return cents < 0 ? `-$${dollars.slice(1)}` : `$${dollars}`
}

function rowsToCSV(rows: TenantRow[]): string {
  const header = ['Customer', 'Phone', 'Cell Phone', 'Email', 'Balance', 'Rentals']
  const lines = [header.join(',')]
  for (const r of rows) {
    const fullName = `${r.firstName} ${r.lastName}`.trim()
    const rentals = r.rentals.join(' ')
    lines.push([
      csvEscape(fullName),
      csvEscape(r.phone),
      csvEscape(r.cellPhone),
      csvEscape(r.email),
      csvEscape(formatBalanceForExport(r.balance)),
      csvEscape(rentals),
    ].join(','))
  }
  return lines.join('\r\n')
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildPrintableHTML(rows: TenantRow[]): string {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const rowsHtml = rows.map((r) => {
    const name = `${r.firstName} ${r.lastName}`.trim()
    const rentals = r.rentals.join(' ')
    return `<tr>
      <td>${escapeHTML(name)}</td>
      <td>${escapeHTML(r.phone)}</td>
      <td>${escapeHTML(r.cellPhone)}</td>
      <td>${escapeHTML(r.email)}</td>
      <td>${escapeHTML(formatBalanceForExport(r.balance))}</td>
      <td>${escapeHTML(rentals)}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Customers — ${today}</title>
    <style>
      @page { size: letter landscape; margin: 0.5in; }
      body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f2937; padding: 0; margin: 0; }
      h1 { font-size: 22px; margin: 0 0 4px; color: #1C0F06; }
      .subtitle { font-size: 12px; color: #6B7280; margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; }
      th { background: #1C0F06; color: white; padding: 6px 8px; text-align: left; font-weight: 600; }
      td { padding: 5px 8px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
      tr:nth-child(even) td { background: #FAFAFA; }
    </style></head><body>
    <h1>Customers</h1>
    <div class="subtitle">${rows.length} customer${rows.length === 1 ? '' : 's'} — generated ${today}</div>
    <table>
      <thead><tr>
        <th>Customer</th><th>Phone</th><th>Cell Phone</th><th>Email</th><th>Balance</th><th>Rentals</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <script>window.onload = () => { window.print(); };</script>
    </body></html>`
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<TenantGroupId>('all')
  const [rows, setRows] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTenants = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: 'all' })
      if (groupFilter !== 'all') params.set('group', groupFilter)
      if (search) params.set('search', search)

      const [tenantRes, unitRes] = await Promise.all([
        fetch(`/api/tenants?${params}`),
        fetch('/api/units?limit=all'),
      ])
      const tenantJson = await tenantRes.json()
      const unitJson = await unitRes.json()
      if (!tenantJson.success) return

      // Build map: tenantId → [unitNumbers]
      const rentalsByTenant = new Map<string, string[]>()
      if (unitJson.success) {
        for (const u of unitJson.data?.items ?? []) {
          if (!u.currentTenantId) continue
          const tid = String(u.currentTenantId)
          if (!rentalsByTenant.has(tid)) rentalsByTenant.set(tid, [])
          rentalsByTenant.get(tid)!.push(u.unitNumber)
        }
      }

      const mapped: TenantRow[] = (tenantJson.data?.items ?? []).map((t: any) => ({
        id: String(t._id),
        firstName: t.firstName ?? '',
        lastName: t.lastName ?? '',
        email: t.email ?? '',
        phone: t.alternatePhone ?? '',
        cellPhone: t.phone ?? '',
        status: t.status as TenantStatus,
        balance: t.balance ?? 0,
        rentals: rentalsByTenant.get(String(t._id))?.sort() ?? [],
      }))

      setRows(mapped)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [groupFilter, search])

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(fetchTenants, 300)
    return () => clearTimeout(timer)
  }, [fetchTenants])

  const filtered = useMemo(() => rows, [rows])

  function handleExportCSV() {
    const csv = rowsToCSV(filtered)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadFile(`\uFEFF${csv}`, `customers-${stamp}.csv`, 'text/csv;charset=utf-8;')
  }

  function handleExportPDF() {
    const html = buildPrintableHTML(filtered)
    const w = window.open('', '_blank', 'noopener,noreferrer')
    if (!w) return
    w.document.open()
    w.document.write(html)
    w.document.close()
  }

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1.4,
      minWidth: 160,
      valueGetter: (_value, row) => `${row.firstName} ${row.lastName}`.trim(),
      renderCell: (params: GridRenderCellParams) => (
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, color: '#1d4ed8', cursor: 'pointer' }}
          onClick={() => router.push(`/admin/tenants/${params.row.id}`)}
        >
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'phone',
      headerName: 'Phone',
      width: 140,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {(params.value as string) || '—'}
        </Typography>
      ),
    },
    {
      field: 'cellPhone',
      headerName: 'Cell Phone',
      width: 140,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {(params.value as string) || '—'}
        </Typography>
      ),
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1.3,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'balance',
      headerName: 'Balance',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => {
        const amt = params.value as number
        const positive = amt > 0
        const negative = amt < 0
        return (
          <Typography
            variant="body2"
            sx={{
              fontWeight: positive ? 600 : 400,
              color: positive ? '#DC2626' : negative ? '#059669' : 'text.primary',
            }}
          >
            {formatMoney(Math.abs(amt))}
            {negative && ' cr'}
          </Typography>
        )
      },
    },
    {
      field: 'rentals',
      headerName: 'Rentals',
      flex: 1.1,
      minWidth: 140,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const list = (params.value as string[]) ?? []
        if (list.length === 0) {
          return <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>
        }
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.5 }}>
            {list.map((unit) => (
              <Chip
                key={unit}
                label={unit}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  bgcolor: '#EFF6FF',
                  color: '#1d4ed8',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            ))}
          </Box>
        )
      },
    },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Customers
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            disabled={loading || rows.length === 0}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            disabled={loading || rows.length === 0}
            onClick={handleExportPDF}
          >
            PDF
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disableElevation
            onClick={() => router.push('/admin/tenants/new')}
            sx={{ bgcolor: '#8CA87C', '&:hover': { bgcolor: '#7E9770' } }}
          >
            New Customer
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Search customers"
              placeholder="Search by name, unit, email, or phone..."
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 240 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>Group</InputLabel>
              <Select
                label="Group"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value as TenantGroupId)}
              >
                {TENANT_GROUPS.map((g) => (
                  <MenuItem key={g.id} value={g.id}>{g.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* DataGrid */}
      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} sx={{ color: '#8CA87C' }} />
          </Box>
        ) : (
          <DataGrid
            rows={filtered}
            columns={columns}
            rowHeight={48}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            disableRowSelectionOnClick
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeader': {
                bgcolor: '#1C0F06',
                color: 'white',
                fontWeight: 600,
              },
              '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
              '& .MuiDataGrid-sortIcon': { color: 'rgba(255,255,255,0.7)' },
              '& .MuiDataGrid-menuIconButton': { color: 'rgba(255,255,255,0.7)' },
              '& .MuiDataGrid-row:hover': { bgcolor: '#FAF7F2' },
              '& .MuiDataGrid-cell': {
                borderColor: '#EDE5D8',
                display: 'flex',
                alignItems: 'center',
              },
              '& .MuiDataGrid-footerContainer': { borderColor: '#EDE5D8' },
            }}
          />
        )}
      </Card>
    </Box>
  )
}
