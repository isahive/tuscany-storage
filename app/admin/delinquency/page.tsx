'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridRowSelectionModel,
} from '@mui/x-data-grid'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import LockIcon from '@mui/icons-material/Lock'
import GavelIcon from '@mui/icons-material/Gavel'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityIcon from '@mui/icons-material/Visibility'
import CloseIcon from '@mui/icons-material/Close'
import { useRouter } from 'next/navigation'
import { formatMoney, formatDate } from '@/lib/utils'
import type { TenantStatus } from '@/types'

// ── Stage definitions ────────────────────────────────────────────────────────

type DelinquencyStage = 'Late' | 'Locked Out' | 'Pre-Lien' | 'Lien'

const STAGE_COLORS: Record<DelinquencyStage, { bg: string; color: string }> = {
  'Late':       { bg: '#FEF3C7', color: '#92400E' },
  'Locked Out': { bg: '#FEE2E2', color: '#991B1B' },
  'Pre-Lien':   { bg: '#FEE2E2', color: '#7F1D1D' },
  'Lien':       { bg: '#7F1D1D', color: '#FFFFFF' },
}

function getStage(daysPastDue: number): DelinquencyStage {
  if (daysPastDue >= 45) return 'Lien'
  if (daysPastDue >= 30) return 'Pre-Lien'
  if (daysPastDue >= 10) return 'Locked Out'
  return 'Late'
}

// ── Mock data ────────────────────────────────────────────────────────────────

interface DelinquentRow {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  unit: string
  size: string
  status: TenantStatus
  daysPastDue: number
  balance: number        // cents
  monthlyRate: number    // cents
  lastPaymentDate: string
  lastContactDate: string | null
}

const MOCK_DELINQUENTS: DelinquentRow[] = [
  {
    id: '1',  firstName: 'Patricia', lastName: 'Nguyen',
    email: 'p.nguyen@email.com',  phone: '(512) 555-0201',
    unit: '03B', size: '10x20', status: 'locked_out',
    daysPastDue: 52, balance: 58500, monthlyRate: 18500,
    lastPaymentDate: '2026-02-14', lastContactDate: '2026-03-20',
  },
  {
    id: '2',  firstName: 'Robert',  lastName: 'Chen',
    email: 'r.chen@email.com',    phone: '(512) 555-0102',
    unit: '12A', size: '10x10', status: 'locked_out',
    daysPastDue: 46, balance: 41000, monthlyRate: 12500,
    lastPaymentDate: '2026-02-20', lastContactDate: '2026-03-15',
  },
  {
    id: '3',  firstName: 'Marcus',  lastName: 'Reeves',
    email: 'm.reeves@email.com',  phone: '(512) 555-0203',
    unit: '28A', size: '10x15', status: 'locked_out',
    daysPastDue: 35, balance: 34500, monthlyRate: 15500,
    lastPaymentDate: '2026-03-02', lastContactDate: '2026-03-28',
  },
  {
    id: '4',  firstName: 'Maria',   lastName: 'Santos',
    email: 'maria.s@email.com',   phone: '(512) 555-0103',
    unit: '07C', size: '10x20', status: 'locked_out',
    daysPastDue: 22, balance: 24000, monthlyRate: 16500,
    lastPaymentDate: '2026-03-15', lastContactDate: '2026-04-01',
  },
  {
    id: '5',  firstName: 'Thomas',  lastName: 'Bradley',
    email: 't.bradley@email.com', phone: '(512) 555-0205',
    unit: '15D', size: '5x10',  status: 'locked_out',
    daysPastDue: 14, balance: 18000, monthlyRate: 10000,
    lastPaymentDate: '2026-03-23', lastContactDate: null,
  },
  {
    id: '6',  firstName: 'David',   lastName: 'Kim',
    email: 'd.kim@email.com',     phone: '(512) 555-0104',
    unit: '31B', size: '10x10', status: 'delinquent',
    daysPastDue: 8,  balance: 15500, monthlyRate: 10000,
    lastPaymentDate: '2026-03-29', lastContactDate: '2026-04-04',
  },
  {
    id: '7',  firstName: 'Angela',  lastName: 'Torres',
    email: 'a.torres@email.com',  phone: '(512) 555-0105',
    unit: '19D', size: '5x5',  status: 'delinquent',
    daysPastDue: 6,  balance: 10000, monthlyRate: 8500,
    lastPaymentDate: '2026-04-01', lastContactDate: null,
  },
  {
    id: '8',  firstName: 'Jerome',  lastName: 'Washington',
    email: 'j.wash@email.com',    phone: '(512) 555-0208',
    unit: '09A', size: '10x15', status: 'delinquent',
    daysPastDue: 5,  balance: 15500, monthlyRate: 15500,
    lastPaymentDate: '2026-04-02', lastContactDate: null,
  },
]

// ── Summary card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
  subLabel?: string
}

function SummaryCard({ label, value, icon, iconBg, subLabel }: SummaryCardProps) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {label}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1 }}>
              {value}
            </Typography>
            {subLabel && (
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                {subLabel}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: iconBg,
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

// ── Confirm dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={onConfirm}
          sx={{ bgcolor: '#991B1B', '&:hover': { bgcolor: '#7F1D1D' } }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DelinquencyPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [rowSelection, setRowSelection] = useState<GridRowSelectionModel>([])
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' })
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    confirmLabel: string
    onConfirm: () => void
  }>({ open: false, title: '', description: '', confirmLabel: '', onConfirm: () => {} })

  // Sorted by days past due descending
  const rows = useMemo(() => {
    const sorted = [...MOCK_DELINQUENTS].sort((a, b) => b.daysPastDue - a.daysPastDue)
    if (!search) return sorted
    const term = search.toLowerCase()
    return sorted.filter((r) => {
      const fullName = `${r.firstName} ${r.lastName}`.toLowerCase()
      return (
        fullName.includes(term) ||
        r.unit.toLowerCase().includes(term) ||
        r.email.toLowerCase().includes(term)
      )
    })
  }, [search])

  // Summary calculations
  const summary = useMemo(() => {
    const totalDelinquent = MOCK_DELINQUENTS.length
    const totalOwed = MOCK_DELINQUENTS.reduce((sum, r) => sum + r.balance, 0)
    const lockedOut = MOCK_DELINQUENTS.filter((r) => r.daysPastDue >= 10).length
    const preLienOrLien = MOCK_DELINQUENTS.filter((r) => r.daysPastDue >= 30).length
    return { totalDelinquent, totalOwed, lockedOut, preLienOrLien }
  }, [])

  const selectedCount = rowSelection.length

  // Bulk action handlers
  const showSnackbar = useCallback((message: string) => {
    setSnackbar({ open: true, message })
    setRowSelection([])
  }, [])

  const handleSendReminder = useCallback(() => {
    setConfirmDialog({
      open: true,
      title: 'Send Payment Reminder',
      description: `Send a payment reminder to ${selectedCount} selected tenant${selectedCount !== 1 ? 's' : ''}? They will receive an email and SMS notification.`,
      confirmLabel: 'Send Reminder',
      onConfirm: () => {
        // TODO: call POST /api/admin/delinquency/remind
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        showSnackbar(`Payment reminder sent to ${selectedCount} tenant${selectedCount !== 1 ? 's' : ''}.`)
      },
    })
  }, [selectedCount, showSnackbar])

  const handleLockOut = useCallback(() => {
    const eligible = MOCK_DELINQUENTS.filter(
      (r) => rowSelection.includes(r.id) && r.daysPastDue < 10,
    )
    const alreadyLocked = (rowSelection as string[]).length - eligible.length
    const lockCount = eligible.length

    const desc = lockCount > 0
      ? `Lock out ${lockCount} tenant${lockCount !== 1 ? 's' : ''}? Their gate access will be revoked immediately.${alreadyLocked > 0 ? ` (${alreadyLocked} already locked out.)` : ''}`
      : `All ${alreadyLocked} selected tenant${alreadyLocked !== 1 ? 's are' : ' is'} already locked out.`

    setConfirmDialog({
      open: true,
      title: 'Lock Out Tenants',
      description: desc,
      confirmLabel: lockCount > 0 ? 'Lock Out' : 'OK',
      onConfirm: () => {
        // TODO: call POST /api/admin/delinquency/lockout
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        if (lockCount > 0) {
          showSnackbar(`${lockCount} tenant${lockCount !== 1 ? 's' : ''} locked out.`)
        }
      },
    })
  }, [rowSelection, showSnackbar])

  const handleMarkForAuction = useCallback(() => {
    const eligible = MOCK_DELINQUENTS.filter(
      (r) => rowSelection.includes(r.id) && r.daysPastDue >= 45,
    )
    const ineligible = (rowSelection as string[]).length - eligible.length

    const desc = eligible.length > 0
      ? `Mark ${eligible.length} unit${eligible.length !== 1 ? 's' : ''} for auction? This will initiate the auction process for lien-stage tenants.${ineligible > 0 ? ` (${ineligible} selected tenant${ineligible !== 1 ? 's do' : ' does'} not qualify — must be 45+ days past due.)` : ''}`
      : `None of the selected tenants qualify for auction. Tenants must be 45+ days past due (Lien stage).`

    setConfirmDialog({
      open: true,
      title: 'Mark for Auction',
      description: desc,
      confirmLabel: eligible.length > 0 ? 'Mark for Auction' : 'OK',
      onConfirm: () => {
        // TODO: call POST /api/admin/delinquency/auction
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        if (eligible.length > 0) {
          showSnackbar(`${eligible.length} unit${eligible.length !== 1 ? 's' : ''} marked for auction.`)
        }
      },
    })
  }, [rowSelection, showSnackbar])

  // DataGrid columns
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Tenant',
        flex: 1.5,
        minWidth: 180,
        valueGetter: (_value, row) => `${row.firstName} ${row.lastName}`,
        renderCell: (params: GridRenderCellParams) => (
          <Box sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {params.value as string}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {params.row.email}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'unit',
        headerName: 'Unit',
        width: 100,
        renderCell: (params: GridRenderCellParams) => (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {params.row.unit}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {params.row.size}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'daysPastDue',
        headerName: 'Days Past Due',
        width: 130,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params: GridRenderCellParams) => {
          const days = params.value as number
          return (
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: days >= 30 ? '#7F1D1D' : days >= 10 ? '#991B1B' : '#92400E',
              }}
            >
              {days}
            </Typography>
          )
        },
      },
      {
        field: 'stage',
        headerName: 'Stage',
        width: 130,
        valueGetter: (_value, row) => getStage(row.daysPastDue),
        renderCell: (params: GridRenderCellParams) => {
          const stage = params.value as DelinquencyStage
          const colors = STAGE_COLORS[stage]
          return (
            <Chip
              label={stage}
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
        headerName: 'Balance Owed',
        width: 130,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params: GridRenderCellParams) => (
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#DC2626' }}>
            {formatMoney(params.value as number)}
          </Typography>
        ),
      },
      {
        field: 'monthlyRate',
        headerName: 'Monthly Rate',
        width: 120,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params: GridRenderCellParams) => (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {formatMoney(params.value as number)}
          </Typography>
        ),
      },
      {
        field: 'lastPaymentDate',
        headerName: 'Last Payment',
        width: 130,
        renderCell: (params: GridRenderCellParams) => (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {formatDate(params.value as string)}
          </Typography>
        ),
      },
      {
        field: 'lastContactDate',
        headerName: 'Last Contact',
        width: 130,
        renderCell: (params: GridRenderCellParams) => {
          const date = params.value as string | null
          return (
            <Typography variant="body2" sx={{ color: date ? 'text.secondary' : '#DC2626' }}>
              {date ? formatDate(date) : 'None'}
            </Typography>
          )
        },
      },
      {
        field: 'actions',
        headerName: '',
        width: 56,
        sortable: false,
        disableColumnMenu: true,
        renderCell: (params: GridRenderCellParams) => (
          <Tooltip title="View tenant">
            <IconButton
              size="small"
              onClick={() => router.push(`/admin/tenants/${params.row.id}`)}
              sx={{ color: 'text.secondary' }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [router],
  )

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Delinquency Management
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Monitor and manage past-due accounts across all stages
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            label="Total Delinquent"
            value={summary.totalDelinquent}
            icon={<WarningAmberIcon sx={{ color: '#92400E' }} />}
            iconBg="#FEF3C7"
            subLabel="tenants past due"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            label="Total Owed"
            value={formatMoney(summary.totalOwed)}
            icon={<AttachMoneyIcon sx={{ color: '#DC2626' }} />}
            iconBg="#FEE2E2"
            subLabel="outstanding balance"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            label="Locked Out"
            value={summary.lockedOut}
            icon={<LockIcon sx={{ color: '#991B1B' }} />}
            iconBg="#FEE2E2"
            subLabel="access revoked"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            label="Pre-Lien / Lien"
            value={summary.preLienOrLien}
            icon={<GavelIcon sx={{ color: '#7F1D1D' }} />}
            iconBg="#FEE2E2"
            subLabel="legal action pending"
          />
        </Grid>
      </Grid>

      {/* Search + Bulk Actions */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
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
          </Box>

          {/* Bulk action bar */}
          <Collapse in={selectedCount > 0}>
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: '#FAF7F2',
                border: '1px solid #EDE5D8',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1C0F06', mr: 1 }}>
                {selectedCount} selected
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<NotificationsActiveIcon />}
                onClick={handleSendReminder}
                sx={{
                  borderColor: '#B8914A',
                  color: '#B8914A',
                  '&:hover': { borderColor: '#96743A', bgcolor: 'rgba(184,145,74,0.04)' },
                }}
              >
                Send Reminder
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<LockIcon />}
                onClick={handleLockOut}
                sx={{
                  borderColor: '#991B1B',
                  color: '#991B1B',
                  '&:hover': { borderColor: '#7F1D1D', bgcolor: 'rgba(153,27,27,0.04)' },
                }}
              >
                Lock Out
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<GavelIcon />}
                onClick={handleMarkForAuction}
                sx={{
                  borderColor: '#7F1D1D',
                  color: '#7F1D1D',
                  '&:hover': { borderColor: '#450A0A', bgcolor: 'rgba(127,29,29,0.04)' },
                }}
              >
                Mark for Auction
              </Button>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* DataGrid */}
      <Card>
        <DataGrid
          rows={rows}
          columns={columns}
          checkboxSelection
          rowSelectionModel={rowSelection}
          onRowSelectionModelChange={setRowSelection}
          rowHeight={64}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
            sorting: { sortModel: [{ field: 'daysPastDue', sort: 'desc' }] },
          }}
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
            '& .MuiDataGrid-checkboxInput': {
              color: '#B8914A',
              '&.Mui-checked': { color: '#B8914A' },
            },
            '& .MuiDataGrid-columnHeaderCheckbox .MuiDataGrid-checkboxInput': {
              color: 'rgba(255,255,255,0.7)',
              '&.Mui-checked': { color: '#FFFFFF' },
            },
            '& .MuiDataGrid-row:hover': { bgcolor: '#FAF7F2' },
            '& .MuiDataGrid-row.Mui-selected': {
              bgcolor: 'rgba(184,145,74,0.08)',
              '&:hover': { bgcolor: 'rgba(184,145,74,0.12)' },
            },
            '& .MuiDataGrid-cell': { borderColor: '#EDE5D8' },
            '& .MuiDataGrid-footerContainer': { borderColor: '#EDE5D8' },
          }}
        />
      </Card>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSnackbar({ open: false, message: '' })}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
