'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Alert,
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
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import SearchIcon from '@mui/icons-material/Search'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { formatDate } from '@/lib/utils'
import type { WaitingListStatus } from '@/types'

// ── Status chip config ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<WaitingListStatus, { bg: string; color: string }> = {
  waiting:   { bg: '#DBEAFE', color: '#1E3A5F' },
  notified:  { bg: '#FEF3C7', color: '#92400E' },
  converted: { bg: '#D1FAE5', color: '#065F46' },
  expired:   { bg: '#F3F4F6', color: '#374151' },
}

const STATUS_LABELS: Record<WaitingListStatus, string> = {
  waiting:   'Waiting',
  notified:  'Notified',
  converted: 'Converted',
  expired:   'Expired',
}

// ── Mock data ─────────────────────────────────────────────────────────────────

interface WaitingListRow {
  id: string
  name: string
  email: string
  phone: string
  preferredSize: string
  preferredType: string
  desiredMoveInDate: string
  status: WaitingListStatus
  notes?: string
  notifiedAt?: string
  createdAt: string
}

const INITIAL_DATA: WaitingListRow[] = [
  { id: '1',  name: 'Jessica Rivera',  email: 'j.rivera@email.com',  phone: '(512) 555-0201', preferredSize: '10x10', preferredType: 'Climate Controlled', desiredMoveInDate: '2026-05-01', status: 'waiting',   createdAt: '2026-03-12' },
  { id: '2',  name: 'Thomas Wright',   email: 't.wright@email.com',  phone: '(512) 555-0202', preferredSize: '10x20', preferredType: 'Drive-Up',           desiredMoveInDate: '2026-04-15', status: 'notified',  notifiedAt: '2026-04-01', createdAt: '2026-02-28' },
  { id: '3',  name: 'Hannah Lee',      email: 'h.lee@email.com',     phone: '(512) 555-0203', preferredSize: '5x10',  preferredType: 'Standard',           desiredMoveInDate: '2026-04-20', status: 'waiting',   createdAt: '2026-03-18' },
  { id: '4',  name: 'Marcus Johnson',  email: 'm.johnson@email.com', phone: '(512) 555-0204', preferredSize: '10x15', preferredType: 'Climate Controlled', desiredMoveInDate: '2026-04-10', status: 'converted', createdAt: '2026-01-15' },
  { id: '5',  name: 'Olivia Chen',     email: 'o.chen@email.com',    phone: '(512) 555-0205', preferredSize: '10x10', preferredType: 'Standard',           desiredMoveInDate: '2026-05-15', status: 'waiting',   createdAt: '2026-03-22' },
  { id: '6',  name: 'Daniel Brooks',   email: 'd.brooks@email.com',  phone: '(512) 555-0206', preferredSize: '10x30', preferredType: 'Drive-Up',           desiredMoveInDate: '2026-03-01', status: 'expired',   createdAt: '2025-12-10' },
  { id: '7',  name: 'Sophia Martinez', email: 's.martinez@email.com',phone: '(512) 555-0207', preferredSize: '5x5',   preferredType: 'Standard',           desiredMoveInDate: '2026-06-01', status: 'waiting',   createdAt: '2026-03-30' },
  { id: '8',  name: 'Ethan Patel',     email: 'e.patel@email.com',   phone: '(512) 555-0208', preferredSize: '10x20', preferredType: 'Climate Controlled', desiredMoveInDate: '2026-04-25', status: 'notified',  notifiedAt: '2026-04-03', createdAt: '2026-02-20' },
]

// ── Convert-to-tenant dialog ─────────────────────────────────────────────────

interface ConvertDialogProps {
  open: boolean
  entry: WaitingListRow | null
  onClose: () => void
  onConvert: (entryId: string) => void
}

function ConvertDialog({ open, entry, onClose, onConvert }: ConvertDialogProps) {
  const nameParts = entry?.name.split(' ') ?? ['', '']
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts.slice(1).join(' ') ?? ''

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    unit: '',
    startDate: '',
    size: '',
    type: '',
  })

  // Re-sync form when the entry changes
  const currentEntryId = entry?.id ?? ''
  const [lastEntryId, setLastEntryId] = useState('')
  if (currentEntryId && currentEntryId !== lastEntryId) {
    setLastEntryId(currentEntryId)
    setForm({
      firstName,
      lastName,
      email: entry?.email ?? '',
      phone: entry?.phone ?? '',
      unit: '',
      startDate: entry?.desiredMoveInDate ?? '',
      size: entry?.preferredSize ?? '',
      type: entry?.preferredType ?? '',
    })
  }

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = () => {
    // TODO: call POST /api/admin/move-in with pre-filled data
    console.log('Convert to tenant:', form)
    onConvert(currentEntryId)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonAddIcon sx={{ color: '#B8914A' }} />
        Convert to Tenant
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Pre-filled from waiting list entry. Assign a unit and confirm details to create a new tenant.
        </Typography>
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
              label="Preferred Size"
              fullWidth
              size="small"
              value={form.size}
              onChange={handleChange('size')}
              disabled
              sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#374151' } }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Preferred Type"
              fullWidth
              size="small"
              value={form.type}
              onChange={handleChange('type')}
              disabled
              sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#374151' } }}
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
              required
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
        <Button
          variant="contained"
          onClick={handleSubmit}
          disableElevation
          disabled={!form.unit}
          startIcon={<PersonAddIcon />}
          sx={{
            bgcolor: '#B8914A',
            '&:hover': { bgcolor: '#9E7B3D' },
          }}
        >
          Create Tenant
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Summary card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string
  count: number
  icon: React.ReactNode
  bgColor: string
  textColor: string
}

function SummaryCard({ title, count, icon, bgColor, textColor }: SummaryCardProps) {
  return (
    <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: textColor }}>
              {count}
            </Typography>
          </Box>
          <Box
            sx={{
              bgcolor: bgColor,
              borderRadius: 1.5,
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type StatusFilter = WaitingListStatus | 'all'

export default function WaitingListPage() {
  const [rows, setRows] = useState<WaitingListRow[]>(INITIAL_DATA)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<WaitingListRow | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // ── Counts ──────────────────────────────────────────────────────────────────

  const counts = useMemo(() => {
    return rows.reduce<Record<WaitingListStatus, number>>(
      (acc, r) => { acc[r.status]++; return acc },
      { waiting: 0, notified: 0, converted: 0, expired: 0 },
    )
  }, [rows])

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase()) ||
        r.phone.includes(search)
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [rows, search, statusFilter])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleNotify = useCallback((entryId: string) => {
    // TODO: call POST /api/admin/waiting-list/:id/notify
    setRows((prev) =>
      prev.map((r) =>
        r.id === entryId
          ? { ...r, status: 'notified' as WaitingListStatus, notifiedAt: new Date().toISOString() }
          : r,
      ),
    )
    setSnackbar({ open: true, message: 'Notification sent via SMS and email.', severity: 'success' })
  }, [])

  const handleConvert = useCallback((entryId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === entryId ? { ...r, status: 'converted' as WaitingListStatus } : r,
      ),
    )
    setSnackbar({ open: true, message: 'Tenant created successfully.', severity: 'success' })
  }, [])

  const openConvertDialog = useCallback((entry: WaitingListRow) => {
    setSelectedEntry(entry)
    setConvertDialogOpen(true)
  }, [])

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1.2,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1.3,
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
      field: 'preferredSize',
      headerName: 'Preferred Size',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">{params.value as string}</Typography>
      ),
    },
    {
      field: 'preferredType',
      headerName: 'Preferred Type',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">{params.value as string}</Typography>
      ),
    },
    {
      field: 'desiredMoveInDate',
      headerName: 'Desired Move-In',
      width: 140,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value ? formatDate(params.value as string) : '—'}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const s = params.value as WaitingListStatus
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
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as WaitingListRow
        const canNotify = row.status === 'waiting'
        const canConvert = row.status === 'waiting' || row.status === 'notified'

        return (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Tooltip title={canNotify ? 'Notify (SMS & Email)' : 'Already notified'}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canNotify}
                  onClick={() => handleNotify(row.id)}
                  sx={{
                    color: canNotify ? '#B8914A' : undefined,
                    '&:hover': canNotify ? { bgcolor: 'rgba(184, 145, 74, 0.08)' } : undefined,
                  }}
                >
                  <NotificationsActiveIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canConvert ? 'Convert to tenant' : 'Cannot convert'}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canConvert}
                  onClick={() => openConvertDialog(row)}
                  sx={{
                    color: canConvert ? '#065F46' : undefined,
                    '&:hover': canConvert ? { bgcolor: 'rgba(6, 95, 70, 0.08)' } : undefined,
                  }}
                >
                  <PersonAddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )
      },
    },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Waiting List
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {rows.length} total entries
        </Typography>
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <SummaryCard
            title="Total Waiting"
            count={counts.waiting}
            icon={<HourglassEmptyIcon sx={{ color: '#1E3A5F' }} />}
            bgColor="#DBEAFE"
            textColor="#1E3A5F"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SummaryCard
            title="Notified"
            count={counts.notified}
            icon={<MarkEmailReadIcon sx={{ color: '#92400E' }} />}
            bgColor="#FEF3C7"
            textColor="#92400E"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SummaryCard
            title="Converted"
            count={counts.converted}
            icon={<SwapHorizIcon sx={{ color: '#065F46' }} />}
            bgColor="#D1FAE5"
            textColor="#065F46"
          />
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 2, border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search by name, email, or phone..."
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
                <MenuItem value="waiting">Waiting</MenuItem>
                <MenuItem value="notified">Notified</MenuItem>
                <MenuItem value="converted">Converted</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* DataGrid */}
      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          rowHeight={56}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick
          sx={{
            border: 'none',
            bgcolor: '#FFFFFF',
            '& .MuiDataGrid-columnHeader': {
              bgcolor: '#1C0F06',
              color: '#FFFFFF',
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
            '& .MuiDataGrid-columnSeparator': { color: 'rgba(255,255,255,0.2)' },
          }}
        />
      </Card>

      {/* Convert dialog */}
      <ConvertDialog
        open={convertDialogOpen}
        entry={selectedEntry}
        onClose={() => {
          setConvertDialogOpen(false)
          setSelectedEntry(null)
        }}
        onConvert={handleConvert}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
