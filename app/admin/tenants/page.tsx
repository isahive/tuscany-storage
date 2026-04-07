'use client'

import { useState, useMemo } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
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

// ── Mock data ─────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  unit: string
  status: TenantStatus
  balance: number   // cents — negative = credit, positive = owed
  nextPayment: string
  nextPaymentAmount: number  // cents
}

const MOCK_TENANTS: TenantRow[] = [
  { id: '1',  firstName: 'Emily',   lastName: 'Johnson',  email: 'emily.j@email.com',    phone: '(512) 555-0101', unit: '05A', status: 'active',     balance: 0,      nextPayment: '2026-04-15', nextPaymentAmount: 12500 },
  { id: '2',  firstName: 'Robert',  lastName: 'Chen',     email: 'r.chen@email.com',      phone: '(512) 555-0102', unit: '12A', status: 'locked_out', balance: 18500,  nextPayment: '2026-03-24', nextPaymentAmount: 12500 },
  { id: '3',  firstName: 'Maria',   lastName: 'Santos',   email: 'maria.s@email.com',     phone: '(512) 555-0103', unit: '07C', status: 'locked_out', balance: 24000,  nextPayment: '2026-03-17', nextPaymentAmount: 16500 },
  { id: '4',  firstName: 'David',   lastName: 'Kim',      email: 'd.kim@email.com',        phone: '(512) 555-0104', unit: '31B', status: 'delinquent', balance: 15500,  nextPayment: '2026-03-29', nextPaymentAmount: 10000 },
  { id: '5',  firstName: 'Angela',  lastName: 'Torres',   email: 'a.torres@email.com',    phone: '(512) 555-0105', unit: '19D', status: 'delinquent', balance: 10000,  nextPayment: '2026-04-01', nextPaymentAmount: 10000 },
  { id: '6',  firstName: 'James',   lastName: 'Wilson',   email: 'j.wilson@email.com',    phone: '(512) 555-0106', unit: '04A', status: 'active',     balance: 0,      nextPayment: '2026-04-20', nextPaymentAmount: 15500 },
  { id: '7',  firstName: 'Lisa',    lastName: 'Nakamura', email: 'lisa.n@email.com',      phone: '(512) 555-0107', unit: '22B', status: 'active',     balance: 0,      nextPayment: '2026-04-18', nextPaymentAmount: 13000 },
  { id: '8',  firstName: 'Kevin',   lastName: 'Murphy',   email: 'k.murphy@email.com',    phone: '(512) 555-0108', unit: '08A', status: 'active',     balance: 0,      nextPayment: '2026-04-10', nextPaymentAmount: 20000 },
  { id: '9',  firstName: 'Sandra',  lastName: 'Hayes',    email: 's.hayes@email.com',     phone: '(512) 555-0109', unit: '16C', status: 'active',     balance: 0,      nextPayment: '2026-04-12', nextPaymentAmount: 12500 },
  { id: '10', firstName: 'Michael', lastName: 'Patel',    email: 'm.patel@email.com',     phone: '(512) 555-0110', unit: '27A', status: 'active',     balance: 0,      nextPayment: '2026-04-08', nextPaymentAmount: 18000 },
]

// ── Move-in dialog ────────────────────────────────────────────────────────────

interface MoveInDialogProps {
  open: boolean
  onClose: () => void
}

function MoveInDialog({ open, onClose }: MoveInDialogProps) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    unit: '',
    startDate: '',
  })

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = () => {
    // TODO: call POST /api/admin/move-in
    console.log('Move-in form submitted:', form)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>New Tenant Move-In</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={6}>
            <TextField
              label="First Name"
              fullWidth
              size="small"
              value={form.firstName}
              onChange={handleChange('firstName')}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Last Name"
              fullWidth
              size="small"
              value={form.lastName}
              onChange={handleChange('lastName')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              size="small"
              value={form.email}
              onChange={handleChange('email')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Phone"
              fullWidth
              size="small"
              value={form.phone}
              onChange={handleChange('phone')}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Unit Number"
              fullWidth
              size="small"
              value={form.unit}
              onChange={handleChange('unit')}
              placeholder="e.g. 14B"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Move-In Date"
              type="date"
              fullWidth
              size="small"
              value={form.startDate}
              onChange={handleChange('startDate')}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disableElevation>
          Create Tenant
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type StatusFilter = TenantStatus | 'all'

export default function TenantsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [moveInOpen, setMoveInOpen] = useState(false)

  const filtered = useMemo(() => {
    return MOCK_TENANTS.filter((t) => {
      const fullName = `${t.firstName} ${t.lastName}`.toLowerCase()
      const matchesSearch =
        !search ||
        fullName.includes(search.toLowerCase()) ||
        t.unit.toLowerCase().includes(search.toLowerCase()) ||
        t.email.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [search, statusFilter])

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
      field: 'nextPayment',
      headerName: 'Next Payment',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as TenantRow
        return (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {formatMoney(row.nextPaymentAmount)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              due {formatDate(row.nextPayment)}
            </Typography>
          </Box>
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
          onClick={() => setMoveInOpen(true)}
        >
          New Tenant
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search by name, unit, or email…"
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
      </Card>

      <MoveInDialog open={moveInOpen} onClose={() => setMoveInOpen(false)} />
    </Box>
  )
}
