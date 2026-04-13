'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Stack,
  CircularProgress,
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import RefreshIcon from '@mui/icons-material/Refresh'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import { formatMoney, formatDate } from '@/lib/utils'
import type { Payment, PaymentStatus, PaymentType } from '@/types'

// ── Status chip styling ─────────────────────────────────────────────────────

const STATUS_CHIP_COLORS: Record<PaymentStatus, { bg: string; color: string }> = {
  succeeded: { bg: '#D1FAE5', color: '#065F46' },
  failed:    { bg: '#FEE2E2', color: '#991B1B' },
  pending:   { bg: '#FEF3C7', color: '#92400E' },
  refunded:  { bg: '#F3F4F6', color: '#374151' },
}

// ── Summary card component ──────────────────────────────────────────────────

interface SummaryCardProps {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  subLabel?: string
}

function SummaryCard({ label, value, icon, iconBg, subLabel }: SummaryCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
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
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

// ── Revenue bar chart (MUI Box-based) ───────────────────────────────────────

function RevenueChart({ data }: { data: { month: string; amount: number }[] }) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1)

  return (
    <Card>
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #EDE5D8' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Monthly Revenue
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Last 6 months
          </Typography>
        </Box>
        <Box sx={{ px: 3, py: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 180 }}>
            {data.map((d) => {
              const heightPct = maxAmount > 0 ? (d.amount / maxAmount) * 100 : 0
              return (
                <Tooltip
                  key={d.month}
                  title={formatMoney(d.amount)}
                  arrow
                  placement="top"
                >
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, fontWeight: 500, fontSize: '0.65rem' }}>
                      {formatMoney(d.amount)}
                    </Typography>
                    <Box
                      sx={{
                        width: '100%',
                        maxWidth: 56,
                        height: `${heightPct}%`,
                        minHeight: 4,
                        bgcolor: '#B8914A',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                        '&:hover': { bgcolor: '#A07A3A' },
                      }}
                    />
                    <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary', fontWeight: 600 }}>
                      {d.month}
                    </Typography>
                  </Box>
                </Tooltip>
              )
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

// ── Status chip renderer ────────────────────────────────────────────────────

function StatusChip({ status }: { status: PaymentStatus }) {
  const colors = STATUS_CHIP_COLORS[status]
  return (
    <Chip
      label={status.charAt(0).toUpperCase() + status.slice(1)}
      size="small"
      sx={{
        bgcolor: colors.bg,
        color: colors.color,
        fontWeight: 600,
        fontSize: '0.7rem',
      }}
    />
  )
}

// ── Type label helper ───────────────────────────────────────────────────────

const TYPE_LABELS: Record<PaymentType, string> = {
  rent: 'Rent',
  late_fee: 'Late Fee',
  deposit: 'Deposit',
  prorated: 'Prorated',
  other: 'Other',
}

// ── Map API status to PaymentStatus ─────────────────────────────────────────

function mapApiStatus(apiStatus: string): PaymentStatus {
  if (apiStatus === 'completed') return 'succeeded'
  if (['succeeded', 'failed', 'pending', 'refunded'].includes(apiStatus)) return apiStatus as PaymentStatus
  return 'pending'
}

// ── Map API type to PaymentType ─────────────────────────────────────────────

function mapApiType(apiType: string): PaymentType {
  if (['rent', 'late_fee', 'deposit', 'prorated', 'other'].includes(apiType)) return apiType as PaymentType
  return 'other'
}

// ── API row type ────────────────────────────────────────────────────────────

interface ApiRow {
  date: string
  tenant: string
  type: string
  method: string
  status: string
  amount: number
  description: string
  stripeId: string
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<PaymentType | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [retryingId, setRetryingId] = useState<string | null>(null)

  // ── Fetch data on mount ─────────────────────────────────────────────────

  useEffect(() => {
    async function fetchPayments() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/reports?type=transactions')
        if (!res.ok) throw new Error(`Failed to fetch payments: ${res.status}`)
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Unknown error')

        const rows: ApiRow[] = json.data.rows
        const mapped: Payment[] = rows.map((row, index) => ({
          _id: `pay_${index}`,
          tenantId: row.tenant,
          leaseId: '',
          unitId: '\u2014',
          stripePaymentIntentId: row.stripeId || '',
          amount: row.amount,
          currency: 'usd' as const,
          type: mapApiType(row.type),
          status: mapApiStatus(row.status),
          periodStart: row.date,
          periodEnd: row.date,
          attemptCount: row.status === 'failed' ? 1 : row.status === 'completed' || row.status === 'succeeded' ? 1 : 0,
          lastAttemptAt: row.date,
          failureReason: row.status === 'failed' ? (row.description || 'Payment failed') : undefined,
          receiptUrl: (row.status === 'completed' || row.status === 'succeeded') && row.stripeId ? `#${row.stripeId}` : undefined,
          createdAt: row.date,
          updatedAt: row.date,
        }))

        setPayments(mapped)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payments')
      } finally {
        setLoading(false)
      }
    }

    fetchPayments()
  }, [])

  // ── Summaries ───────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const totalRevenue = payments
      .filter((p) => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount, 0)
    const succeeded = payments.filter((p) => p.status === 'succeeded').length
    const failed = payments.filter((p) => p.status === 'failed').length
    const pending = payments.filter((p) => p.status === 'pending').length
    return { totalRevenue, succeeded, failed, pending }
  }, [payments])

  // ── Monthly revenue chart data ────────────────────────────────────────

  const monthlyRevenue = useMemo(() => {
    const succeededPayments = payments.filter((p) => p.status === 'succeeded')
    const byMonth: Record<string, number> = {}

    succeededPayments.forEach((p) => {
      const d = new Date(p.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      byMonth[key] = (byMonth[key] || 0) + p.amount
    })

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const sorted = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, amount]) => {
        const [, monthStr] = key.split('-')
        return { month: monthNames[parseInt(monthStr, 10) - 1], amount }
      })

    return sorted
  }, [payments])

  // ── Filtered payments ───────────────────────────────────────────────────

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (dateFrom && p.createdAt < dateFrom) return false
      if (dateTo && p.createdAt > dateTo + 'T23:59:59Z') return false
      return true
    })
  }, [payments, statusFilter, typeFilter, dateFrom, dateTo])

  // ── Failed payments ─────────────────────────────────────────────────────

  const failedPayments = useMemo(
    () => payments.filter((p) => p.status === 'failed'),
    [payments],
  )

  // ── Retry handler (mock) ────────────────────────────────────────────────

  const handleRetry = (paymentId: string) => {
    setRetryingId(paymentId)
    // In production: POST /api/admin/payments/:id/retry
    setTimeout(() => {
      setRetryingId(null)
    }, 2000)
  }

  // ── DataGrid columns ───────────────────────────────────────────────────

  const columns: GridColDef[] = [
    {
      field: 'createdAt',
      headerName: 'Date',
      flex: 1,
      minWidth: 120,
      valueFormatter: (value: string) => formatDate(value),
    },
    {
      field: 'tenantId',
      headerName: 'Tenant',
      flex: 1.2,
      minWidth: 140,
    },
    {
      field: 'unitId',
      headerName: 'Unit',
      width: 100,
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 110,
      valueGetter: (value: PaymentType) => TYPE_LABELS[value] ?? value,
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (value: number) => formatMoney(value),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams<Payment, PaymentStatus>) => (
        <StatusChip status={params.value!} />
      ),
    },
    {
      field: 'attemptCount',
      headerName: 'Attempts',
      width: 90,
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: '_id',
      headerName: 'Receipt',
      width: 80,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as Payment
        return row.status === 'succeeded' ? (
          <Tooltip title="View receipt">
            <IconButton size="small" href={`/api/payments/${params.value}/receipt`} target="_blank">
              <ReceiptLongIcon fontSize="small" sx={{ color: '#B8914A' }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            —
          </Typography>
        )
      },
    },
  ]

  // ── Loading state ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────

  if (error) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: 'text.primary' }}>
          Payments
        </Typography>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Box>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: 'text.primary' }}>
        Payments
      </Typography>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            label="Total Revenue"
            value={formatMoney(summary.totalRevenue)}
            icon={<AttachMoneyIcon sx={{ color: '#B8914A' }} />}
            iconBg="#FEF3C7"
            subLabel="from successful payments"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            label="Successful"
            value={String(summary.succeeded)}
            icon={<CheckCircleOutlineIcon sx={{ color: '#065F46' }} />}
            iconBg="#D1FAE5"
            subLabel="payments completed"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            label="Failed"
            value={String(summary.failed)}
            icon={<ErrorOutlineIcon sx={{ color: '#991B1B' }} />}
            iconBg="#FEE2E2"
            subLabel="require attention"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <SummaryCard
            label="Pending"
            value={String(summary.pending)}
            icon={<HourglassEmptyIcon sx={{ color: '#92400E' }} />}
            iconBg="#FEF3C7"
            subLabel="awaiting processing"
          />
        </Grid>
      </Grid>

      {/* Revenue chart */}
      <Box sx={{ mb: 4 }}>
        <RevenueChart data={monthlyRevenue} />
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #EDE5D8' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              All Payments
            </Typography>
          </Box>
          <Box sx={{ px: 3, py: 2, display: 'flex', flexWrap: 'wrap', gap: 2, borderBottom: '1px solid #EDE5D8' }}>
            <TextField
              select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}
              size="small"
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="succeeded">Succeeded</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="refunded">Refunded</MenuItem>
            </TextField>
            <TextField
              select
              label="Type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as PaymentType | 'all')}
              size="small"
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="rent">Rent</MenuItem>
              <MenuItem value="late_fee">Late Fee</MenuItem>
              <MenuItem value="deposit">Deposit</MenuItem>
              <MenuItem value="prorated">Prorated</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
            <TextField
              label="From"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              label="To"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            {(statusFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo) && (
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  setStatusFilter('all')
                  setTypeFilter('all')
                  setDateFrom('')
                  setDateTo('')
                }}
                sx={{ color: '#B8914A', textTransform: 'none' }}
              >
                Clear Filters
              </Button>
            )}
          </Box>

          {/* DataGrid */}
          <Box sx={{ width: '100%' }}>
            <DataGrid
              rows={filteredPayments}
              columns={columns}
              getRowId={(row) => row._id}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
                sorting: { sortModel: [{ field: 'createdAt', sort: 'desc' }] },
              }}
              pageSizeOptions={[5, 10, 25]}
              disableRowSelectionOnClick
              autoHeight
              sx={{
                border: 'none',
                '& .MuiDataGrid-columnHeaders': {
                  bgcolor: '#FAF7F2',
                  borderBottom: '1px solid #EDE5D8',
                },
                '& .MuiDataGrid-cell': {
                  borderBottom: '1px solid #EDE5D8',
                },
                '& .MuiDataGrid-footerContainer': {
                  borderTop: '1px solid #EDE5D8',
                },
                '& .MuiDataGrid-row:hover': {
                  bgcolor: '#FAF7F2',
                },
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Failed payments section */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #EDE5D8', display: 'flex', alignItems: 'center', gap: 1 }}>
            <ErrorOutlineIcon sx={{ color: '#991B1B', fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Failed Payments
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {failedPayments.length} payment{failedPayments.length !== 1 ? 's' : ''} requiring attention
              </Typography>
            </Box>
          </Box>

          {failedPayments.length === 0 ? (
            <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No failed payments at this time.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={0}>
              {failedPayments.map((payment) => (
                <Box
                  key={payment._id}
                  sx={{
                    px: 3,
                    py: 2,
                    borderBottom: '1px solid #EDE5D8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 2,
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {payment.tenantId} — Unit {payment.unitId}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      {formatDate(payment.createdAt)} &middot; {TYPE_LABELS[payment.type]} &middot; {payment.attemptCount} attempt{payment.attemptCount !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 80 }}>
                    {formatMoney(payment.amount)}
                  </Typography>
                  <Alert
                    severity="error"
                    variant="outlined"
                    sx={{
                      py: 0,
                      px: 1.5,
                      flex: '0 1 auto',
                      minWidth: 180,
                      '& .MuiAlert-message': { py: 0.5 },
                    }}
                  >
                    <Typography variant="caption">
                      {payment.failureReason ?? 'Unknown failure'}
                    </Typography>
                  </Alert>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<RefreshIcon />}
                    disabled={retryingId === payment._id}
                    onClick={() => handleRetry(payment._id)}
                    sx={{
                      bgcolor: '#B8914A',
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': { bgcolor: '#A07A3A' },
                      '&.Mui-disabled': {
                        bgcolor: '#EDE5D8',
                        color: '#92400E',
                      },
                    }}
                  >
                    {retryingId === payment._id ? 'Retrying...' : 'Retry'}
                  </Button>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
