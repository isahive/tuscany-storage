'use client'

import { useState, useMemo } from 'react'
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

// ── Mock data ───────────────────────────────────────────────────────────────

const MOCK_PAYMENTS: Payment[] = [
  {
    _id: 'pay_001',
    tenantId: 'ten_001',
    leaseId: 'lea_001',
    unitId: 'unit_12A',
    stripePaymentIntentId: 'pi_3Px001',
    stripeChargeId: 'ch_3Px001',
    amount: 18500,
    currency: 'usd',
    type: 'rent',
    status: 'succeeded',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    attemptCount: 1,
    lastAttemptAt: '2026-03-01T08:00:00Z',
    receiptUrl: '#',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-01T08:00:05Z',
  },
  {
    _id: 'pay_002',
    tenantId: 'ten_002',
    leaseId: 'lea_002',
    unitId: 'unit_07C',
    stripePaymentIntentId: 'pi_3Px002',
    amount: 24000,
    currency: 'usd',
    type: 'rent',
    status: 'failed',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    attemptCount: 3,
    lastAttemptAt: '2026-03-05T14:30:00Z',
    failureReason: 'Card declined — insufficient funds',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-05T14:30:05Z',
  },
  {
    _id: 'pay_003',
    tenantId: 'ten_003',
    leaseId: 'lea_003',
    unitId: 'unit_31B',
    stripePaymentIntentId: 'pi_3Px003',
    stripeChargeId: 'ch_3Px003',
    amount: 15500,
    currency: 'usd',
    type: 'rent',
    status: 'succeeded',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    attemptCount: 1,
    lastAttemptAt: '2026-03-01T08:00:00Z',
    receiptUrl: '#',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-01T08:00:04Z',
  },
  {
    _id: 'pay_004',
    tenantId: 'ten_004',
    leaseId: 'lea_004',
    unitId: 'unit_19D',
    stripePaymentIntentId: 'pi_3Px004',
    amount: 10000,
    currency: 'usd',
    type: 'late_fee',
    status: 'pending',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    attemptCount: 0,
    createdAt: '2026-03-10T12:00:00Z',
    updatedAt: '2026-03-10T12:00:00Z',
  },
  {
    _id: 'pay_005',
    tenantId: 'ten_005',
    leaseId: 'lea_005',
    unitId: 'unit_04A',
    stripePaymentIntentId: 'pi_3Px005',
    stripeChargeId: 'ch_3Px005',
    amount: 22000,
    currency: 'usd',
    type: 'rent',
    status: 'refunded',
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
    attemptCount: 1,
    lastAttemptAt: '2026-02-01T08:00:00Z',
    receiptUrl: '#',
    createdAt: '2026-02-01T08:00:00Z',
    updatedAt: '2026-02-15T10:00:00Z',
  },
  {
    _id: 'pay_006',
    tenantId: 'ten_006',
    leaseId: 'lea_006',
    unitId: 'unit_22B',
    stripePaymentIntentId: 'pi_3Px006',
    stripeChargeId: 'ch_3Px006',
    amount: 5000,
    currency: 'usd',
    type: 'deposit',
    status: 'succeeded',
    periodStart: '2026-03-15',
    periodEnd: '2026-03-15',
    attemptCount: 1,
    lastAttemptAt: '2026-03-15T10:00:00Z',
    receiptUrl: '#',
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-15T10:00:03Z',
  },
  {
    _id: 'pay_007',
    tenantId: 'ten_007',
    leaseId: 'lea_007',
    unitId: 'unit_09C',
    stripePaymentIntentId: 'pi_3Px007',
    amount: 17500,
    currency: 'usd',
    type: 'rent',
    status: 'failed',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    attemptCount: 2,
    lastAttemptAt: '2026-03-03T09:00:00Z',
    failureReason: 'Card expired',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-03T09:00:04Z',
  },
  {
    _id: 'pay_008',
    tenantId: 'ten_008',
    leaseId: 'lea_008',
    unitId: 'unit_15A',
    stripePaymentIntentId: 'pi_3Px008',
    stripeChargeId: 'ch_3Px008',
    amount: 8750,
    currency: 'usd',
    type: 'prorated',
    status: 'succeeded',
    periodStart: '2026-03-15',
    periodEnd: '2026-03-31',
    attemptCount: 1,
    lastAttemptAt: '2026-03-15T08:00:00Z',
    receiptUrl: '#',
    createdAt: '2026-03-15T08:00:00Z',
    updatedAt: '2026-03-15T08:00:04Z',
  },
  {
    _id: 'pay_009',
    tenantId: 'ten_009',
    leaseId: 'lea_009',
    unitId: 'unit_28D',
    stripePaymentIntentId: 'pi_3Px009',
    stripeChargeId: 'ch_3Px009',
    amount: 19500,
    currency: 'usd',
    type: 'rent',
    status: 'succeeded',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    attemptCount: 1,
    lastAttemptAt: '2026-03-01T08:00:00Z',
    receiptUrl: '#',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-01T08:00:06Z',
  },
  {
    _id: 'pay_010',
    tenantId: 'ten_010',
    leaseId: 'lea_010',
    unitId: 'unit_33A',
    stripePaymentIntentId: 'pi_3Px010',
    amount: 12000,
    currency: 'usd',
    type: 'rent',
    status: 'pending',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    attemptCount: 0,
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-04-01T08:00:00Z',
  },
]

// ── Tenant name lookup (in production this comes from the API) ──────────────

const TENANT_NAMES: Record<string, string> = {
  ten_001: 'Robert Chen',
  ten_002: 'Maria Santos',
  ten_003: 'David Kim',
  ten_004: 'Angela Torres',
  ten_005: 'James Wilson',
  ten_006: 'Lisa Nakamura',
  ten_007: 'Tom Bradley',
  ten_008: 'Sarah Patel',
  ten_009: 'Marcus Johnson',
  ten_010: 'Emily Rodriguez',
}

// ── Revenue chart data (last 6 months) ──────────────────────────────────────

const MONTHLY_REVENUE = [
  { month: 'Nov', amount: 156000 },
  { month: 'Dec', amount: 162500 },
  { month: 'Jan', amount: 171000 },
  { month: 'Feb', amount: 168000 },
  { month: 'Mar', amount: 183250 },
  { month: 'Apr', amount: 31500 },
]

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

function RevenueChart() {
  const maxAmount = Math.max(...MONTHLY_REVENUE.map((d) => d.amount))

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
            {MONTHLY_REVENUE.map((d) => {
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

// ── Page ────────────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<PaymentType | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [retryingId, setRetryingId] = useState<string | null>(null)

  // ── Summaries ───────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const totalRevenue = MOCK_PAYMENTS
      .filter((p) => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount, 0)
    const succeeded = MOCK_PAYMENTS.filter((p) => p.status === 'succeeded').length
    const failed = MOCK_PAYMENTS.filter((p) => p.status === 'failed').length
    const pending = MOCK_PAYMENTS.filter((p) => p.status === 'pending').length
    return { totalRevenue, succeeded, failed, pending }
  }, [])

  // ── Filtered payments ───────────────────────────────────────────────────

  const filteredPayments = useMemo(() => {
    return MOCK_PAYMENTS.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (dateFrom && p.createdAt < dateFrom) return false
      if (dateTo && p.createdAt > dateTo + 'T23:59:59Z') return false
      return true
    })
  }, [statusFilter, typeFilter, dateFrom, dateTo])

  // ── Failed payments ─────────────────────────────────────────────────────

  const failedPayments = useMemo(
    () => MOCK_PAYMENTS.filter((p) => p.status === 'failed'),
    [],
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
      valueGetter: (value: string) => TENANT_NAMES[value] ?? value,
    },
    {
      field: 'unitId',
      headerName: 'Unit',
      width: 100,
      valueGetter: (value: string) => value.replace('unit_', ''),
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
      field: 'receiptUrl',
      headerName: 'Receipt',
      width: 80,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (params: GridRenderCellParams) =>
        params.value ? (
          <Tooltip title="View receipt">
            <IconButton size="small" href={params.value as string} target="_blank">
              <ReceiptLongIcon fontSize="small" sx={{ color: '#B8914A' }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            —
          </Typography>
        ),
    },
  ]

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
        <RevenueChart />
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
                      {TENANT_NAMES[payment.tenantId] ?? payment.tenantId} — Unit {payment.unitId.replace('unit_', '')}
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
