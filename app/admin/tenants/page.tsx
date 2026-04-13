'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import VisibilityIcon from '@mui/icons-material/Visibility'
import LockIcon from '@mui/icons-material/Lock'
import { useRouter } from 'next/navigation'
import { formatMoney, formatDate } from '@/lib/utils'
import type { TenantStatus } from '@/types'

// ── Status chip config ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TenantStatus, { bg: string; color: string }> = {
  active:      { bg: '#D1FAE5', color: '#065F46' },
  delinquent:  { bg: '#FEF3C7', color: '#92400E' },
  locked_out:  { bg: '#FEE2E2', color: '#991B1B' },
  moved_out:   { bg: '#F3F4F6', color: '#374151' },
}

const STATUS_LABELS: Record<TenantStatus, string> = {
  active:     'Active',
  delinquent: 'Delinquent',
  locked_out: 'Locked Out',
  moved_out:  'Moved Out',
}

// ── Row type ─────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  unit: string
  status: TenantStatus
  balance: number
  createdAt: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

type StatusFilter = TenantStatus | 'all'

export default function TenantsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [rows, setRows] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTenants = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/tenants?${params}`)
      const json = await res.json()
      if (!json.success) return

      // Fetch leases to map units and balances
      const leaseRes = await fetch('/api/leases?limit=500')
      const leaseJson = await leaseRes.json()
      const leases = leaseJson.success ? leaseJson.data?.items ?? [] : []

      // Build a map: tenantId → { unitNumber, balance }
      const tenantLeaseMap = new Map<string, { unit: string; balance: number }>()
      for (const l of leases) {
        if (l.status === 'ended') continue
        const tid = typeof l.tenantId === 'object' ? l.tenantId._id : l.tenantId
        const unitNum = typeof l.unitId === 'object' ? l.unitId.unitNumber : ''
        tenantLeaseMap.set(tid, { unit: unitNum, balance: l.balance ?? 0 })
      }

      const mapped: TenantRow[] = (json.data?.items ?? []).map((t: Record<string, unknown>) => ({
        id: (t._id as string),
        firstName: t.firstName as string,
        lastName: t.lastName as string,
        email: t.email as string,
        phone: t.phone as string,
        unit: tenantLeaseMap.get(t._id as string)?.unit ?? '—',
        status: t.status as TenantStatus,
        balance: tenantLeaseMap.get(t._id as string)?.balance ?? 0,
        createdAt: t.createdAt as string,
      }))

      setRows(mapped)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(fetchTenants, 300)
    return () => clearTimeout(timer)
  }, [fetchTenants])

  const filtered = useMemo(() => rows, [rows])

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1.5,
      minWidth: 150,
      valueGetter: (_value, row) => `${row.firstName} ${row.lastName}`,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'unit',
      headerName: 'Unit',
      width: 80,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1.2,
      minWidth: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params: GridRenderCellParams) => {
        const s = params.value as TenantStatus
        const colors = STATUS_COLORS[s]
        return (
          <Chip
            label={STATUS_LABELS[s]}
            size="small"
            sx={{
              bgcolor: colors.bg,
              color: colors.color,
              fontWeight: 600,
              fontSize: '0.7rem',
              borderRadius: 1,
            }}
          />
        )
      },
    },
    {
      field: 'balance',
      headerName: 'Balance',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => {
        const amt = params.value as number
        return (
          <Typography
            variant="body2"
            sx={{ fontWeight: 500, color: amt > 0 ? '#DC2626' : 'text.primary' }}
          >
            {amt > 0 ? formatMoney(amt) : '—'}
          </Typography>
        )
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Tooltip title="View tenant">
            <IconButton
              size="small"
              onClick={() => router.push(`/admin/tenants/${params.row.id}`)}
              sx={{ color: 'text.secondary' }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {(params.row.status === 'active' || params.row.status === 'delinquent') && (
            <Tooltip title="Lock out">
              <IconButton size="small" sx={{ color: '#DC2626' }}>
                <LockIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Tenants
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disableElevation
          onClick={() => router.push('/admin/tenants/new')}
        >
          New Tenant
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search by name, unit, or email..."
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
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="delinquent">Delinquent</MenuItem>
                <MenuItem value="locked_out">Locked Out</MenuItem>
                <MenuItem value="moved_out">Moved Out</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* DataGrid */}
      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <DataGrid
            rows={filtered}
            columns={columns}
            rowHeight={56}
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
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
              '& .MuiDataGrid-cell': { borderColor: '#EDE5D8' },
              '& .MuiDataGrid-footerContainer': { borderColor: '#EDE5D8' },
            }}
          />
        )}
      </Card>

    </Box>
  )
}
