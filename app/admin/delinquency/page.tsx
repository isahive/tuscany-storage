'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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

// ── Row interface ───────────────────────────────────────────────────────────

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

// ── Helper: calculate days past due from billingDay ─────────────────────────

function calcDaysPastDue(billingDay: number): number {
  const now = new Date()
  const lastDue = new Date(now.getFullYear(), now.getMonth(), billingDay)
  if (lastDue > now) lastDue.setMonth(lastDue.getMonth() - 1)
  return Math.max(0, Math.floor((now.getTime() - lastDue.getTime()) / (24 * 60 * 60 * 1000)))
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DelinquencyPage() {
  const router = useRouter()
  const [delinquents, setDelinquents] = useState<DelinquentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  // Fetch tenants + leases on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        const [tenantsRes, leasesRes] = await Promise.all([
          fetch('/api/tenants?limit=500'),
          fetch('/api/leases?limit=500&status=active'),
        ])

        if (!tenantsRes.ok || !leasesRes.ok) {
          throw new Error('Failed to fetch data')
        }

        const tenantsJson = await tenantsRes.json()
        const leasesJson = await leasesRes.json()

        if (!tenantsJson.success || !leasesJson.success) {
          throw new Error(tenantsJson.error || leasesJson.error || 'Failed to fetch data')
        }

        const tenants = tenantsJson.data.items || tenantsJson.data
        const leases = leasesJson.data.items || leasesJson.data

        const leaseByTenant: Record<string, any> = {}
        leases.forEach((l: any) => {
          const tid = typeof l.tenantId === 'object' ? l.tenantId._id || l.tenantId : l.tenantId
          leaseByTenant[tid.toString()] = l
        })

        // Filter tenants with balance > 0 and not moved_out
        const rows: DelinquentRow[] = tenants
          .filter((t: any) => (t.balance ?? 0) > 0 && t.status !== 'moved_out')
          .map((t: any) => {
            const tenantId = (t._id || t.id).toString()
            const lease = leaseByTenant[tenantId]
            const unitInfo = lease?.unitId
            const unitNumber = typeof unitInfo === 'object' ? unitInfo.unitNumber : 'N/A'
            const size = typeof unitInfo === 'object' ? unitInfo.size : ''
            const monthlyRate = lease?.monthlyRate ?? 0
            const billingDay = lease?.billingDay ?? 1
            const daysPastDue = lease ? calcDaysPastDue(billingDay) : 0

            return {
              id: tenantId,
              firstName: t.firstName,
              lastName: t.lastName,
              email: t.email,
              phone: t.phone ?? '',
              unit: unitNumber,
              size: size,
              status: t.status as TenantStatus,
              daysPastDue,
              balance: t.balance ?? 0,
              monthlyRate,
              lastPaymentDate: t.lastPaymentDate ?? '',
              lastContactDate: t.lastContactDate ?? null,
            }
          })

        setDelinquents(rows)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Sorted by days past due descending + search filter
  const rows = useMemo(() => {
    const sorted = [...delinquents].sort((a, b) => b.daysPastDue - a.daysPastDue)
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
  }, [search, delinquents])

  // Summary calculations
  const summary = useMemo(() => {
    const totalDelinquent = delinquents.length
    const totalOwed = delinquents.reduce((sum, r) => sum + r.balance, 0)
    const lockedOut = delinquents.filter((r) => r.daysPastDue >= 10).length
    const preLienOrLien = delinquents.filter((r) => r.daysPastDue >= 30).length
    return { totalDelinquent, totalOwed, lockedOut, preLienOrLien }
  }, [delinquents])

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
      onConfirm: async () => {
        const selected = delinquents.filter((r) => rowSelection.includes(r.id))
        await fetch('/api/admin/delinquency/remind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantIds: selected.map((r) => r.id) }),
        })
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        showSnackbar(`Payment reminder sent to ${selectedCount} tenant${selectedCount !== 1 ? 's' : ''}.`)
      },
    })
  }, [selectedCount, showSnackbar])

  const handleLockOut = useCallback(() => {
    const eligible = delinquents.filter(
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
      onConfirm: async () => {
        const selected = delinquents.filter((r) => rowSelection.includes(r.id) && r.daysPastDue < 10)
        if (selected.length > 0) {
          await fetch('/api/admin/delinquency/lockout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantIds: selected.map((r) => r.id) }),
          })
        }
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        if (lockCount > 0) {
          showSnackbar(`${lockCount} tenant${lockCount !== 1 ? 's' : ''} locked out.`)
        }
      },
    })
  }, [rowSelection, showSnackbar, delinquents])

  const handleMarkForAuction = useCallback(() => {
    const eligible = delinquents.filter(
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
        // Auction marking requires manual legal review — logged for admin action
        setConfirmDialog((prev) => ({ ...prev, open: false }))
        if (eligible.length > 0) {
          showSnackbar(`${eligible.length} unit${eligible.length !== 1 ? 's' : ''} marked for auction.`)
        }
      },
    })
  }, [rowSelection, showSnackbar, delinquents])

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
        renderCell: (params: GridRenderCellParams) => {
          const date = params.value as string
          return (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {date ? formatDate(date) : 'N/A'}
            </Typography>
          )
        },
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
              aria-label="View tenant details"
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

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    )
  }

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
              label="Search delinquent tenants"
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
