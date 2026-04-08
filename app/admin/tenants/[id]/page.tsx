'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import NotificationsIcon from '@mui/icons-material/Notifications'
import PaymentIcon from '@mui/icons-material/Payment'
import RefreshIcon from '@mui/icons-material/Refresh'
import { formatMoney, formatDate } from '@/lib/utils'
import type { TenantStatus, PaymentStatus } from '@/types'

// ── Status config ─────────────────────────────────────────────────────────────

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

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, { bg: string; color: string }> = {
  succeeded: { bg: '#D1FAE5', color: '#065F46' },
  failed:    { bg: '#FEE2E2', color: '#991B1B' },
  pending:   { bg: '#FEF3C7', color: '#92400E' },
  refunded:  { bg: '#F3F4F6', color: '#374151' },
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  rent:      'Rent',
  late_fee:  'Late Fee',
  deposit:   'Deposit',
  prorated:  'Prorated',
  other:     'Other',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantData {
  _id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  alternatePhone?: string
  alternateEmail?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  driversLicense?: string
  status: TenantStatus
  autopayEnabled: boolean
  smsOptIn: boolean
  referralSource?: string
  defaultPaymentMethodId?: string
  stripeCustomerId?: string
  gateCode?: string
  createdAt: string
}

interface LeaseData {
  _id: string
  unitId: { _id: string; unitNumber: string; size: string; type: string } | string
  startDate: string
  endDate?: string
  monthlyRate: number
  deposit: number
  billingDay: number
  status: string
  moveOutDate?: string
}

interface PaymentData {
  _id: string
  amount: number
  type: string
  status: PaymentStatus
  createdAt: string
  description?: string
}

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <Box sx={{ display: 'flex', py: 0.75 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', width: 160, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value || '—'}
      </Typography>
    </Box>
  )
}

// ── Make Payment dialog ───────────────────────────────────────────────────────

interface MakePaymentDialogProps {
  open: boolean
  tenantId: string
  leaseId: string
  defaultAmount: number // cents
  onClose: () => void
  onSuccess: () => void
}

function MakePaymentDialog({ open, tenantId, leaseId, defaultAmount, onClose, onSuccess }: MakePaymentDialogProps) {
  const [amount, setAmount] = useState((defaultAmount / 100).toFixed(2))
  const [type, setType] = useState<string>('rent')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset when opened
  useEffect(() => {
    if (open) {
      setAmount((defaultAmount / 100).toFixed(2))
      setType('rent')
      setNote('')
      setError(null)
    }
  }, [open, defaultAmount])

  const handleSubmit = async () => {
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/payments/admin-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, leaseId, amount: parsed, type, note }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Charge failed')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontFamily: '"Playfair Display", serif' }}>
        Make Customer Payment
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label="Amount"
          fullWidth
          size="small"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          sx={{ mb: 2 }}
          type="number"
          inputProps={{ min: 0, step: '0.01' }}
        />

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Payment Type</InputLabel>
          <Select label="Payment Type" value={type} onChange={(e) => setType(e.target.value)}>
            <MenuItem value="rent">Rent</MenuItem>
            <MenuItem value="late_fee">Late Fee</MenuItem>
            <MenuItem value="deposit">Deposit</MenuItem>
            <MenuItem value="prorated">Prorated</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Note (optional)"
          fullWidth
          size="small"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. August rent, partial payment…"
          multiline
          rows={2}
        />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          This will charge the payment method on file immediately.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PaymentIcon />}
        >
          {loading ? 'Processing…' : 'Charge Now'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [tenant, setTenant] = useState<TenantData | null>(null)
  const [lease, setLease] = useState<LeaseData | null>(null)
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tenantRes, leasesRes] = await Promise.all([
        fetch(`/api/tenants/${id}`),
        fetch(`/api/leases?tenantId=${id}&status=active&limit=1`),
      ])

      const tenantJson = await tenantRes.json()
      if (!tenantJson.success) throw new Error(tenantJson.error ?? 'Failed to load tenant')
      const tenantData: TenantData = tenantJson.data
      setTenant(tenantData)

      const leasesJson = await leasesRes.json()
      const activeLeases: LeaseData[] = leasesJson.success ? (leasesJson.data.items ?? []) : []
      const activeLease = activeLeases[0] ?? null
      setLease(activeLease)

      if (activeLease) {
        const paymentsRes = await fetch(`/api/payments?tenantId=${id}&limit=20`)
        const paymentsJson = await paymentsRes.json()
        setPayments(paymentsJson.success ? (paymentsJson.data.items ?? []) : [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <Box>
        <Skeleton width={200} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          {[1, 2].map((i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
          <Grid item xs={12}>
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
          </Grid>
        </Grid>
      </Box>
    )
  }

  if (error || !tenant) {
    return (
      <Alert severity="error" action={<Button onClick={fetchData}>Retry</Button>}>
        {error ?? 'Tenant not found'}
      </Alert>
    )
  }

  const sc = STATUS_COLORS[tenant.status]
  const unitLabel = lease?.unitId && typeof lease.unitId === 'object'
    ? `${lease.unitId.unitNumber} — ${lease.unitId.size}`
    : '—'

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        <IconButton onClick={() => router.push('/admin/tenants')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h5"
          sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', fontWeight: 700 }}
        >
          {tenant.firstName} {tenant.lastName}
        </Typography>
        <Chip
          label={STATUS_LABELS[tenant.status]}
          size="small"
          sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, fontSize: '0.7rem', ml: 0.5 }}
        />
        <IconButton size="small" onClick={fetchData} sx={{ ml: 'auto' }} title="Refresh">
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Locked-out alert */}
      {tenant.status === 'locked_out' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          This tenant is currently <strong>locked out</strong>. Gate access has been revoked.
        </Alert>
      )}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<PaymentIcon />}
          onClick={() => setPaymentOpen(true)}
          disabled={!lease}
        >
          Make Payment
        </Button>
        {tenant.status === 'locked_out' ? (
          <Button variant="outlined" startIcon={<LockOpenIcon />} color="success">
            Restore Access
          </Button>
        ) : (
          <Button variant="outlined" startIcon={<LockIcon />} color="error">
            Lock Out
          </Button>
        )}
        <Button variant="outlined" startIcon={<NotificationsIcon />}>
          Send Notification
        </Button>
        <Button variant="outlined" startIcon={<EditIcon />} onClick={() => router.push(`/admin/tenants/${id}/edit`)}>
          Edit
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Personal info */}
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                Personal Information
              </Typography>
              <Divider sx={{ mb: 1.5 }} />
              <InfoRow label="Email"          value={tenant.email} />
              <InfoRow label="Phone"          value={tenant.phone} />
              <InfoRow label="Alt Phone"      value={tenant.alternatePhone} />
              <InfoRow label="Alt Email"      value={tenant.alternateEmail} />
              <InfoRow label="Address"        value={tenant.address} />
              <InfoRow label="City / State"   value={[tenant.city, tenant.state, tenant.zip].filter(Boolean).join(', ')} />
              <InfoRow label="Driver License" value={tenant.driversLicense} />
              <InfoRow label="Gate Code"      value={tenant.gateCode} />
              <InfoRow label="Referral"       value={tenant.referralSource} />
              <InfoRow label="SMS Opt-In"     value={tenant.smsOptIn ? 'Yes' : 'No'} />
              <InfoRow label="Autopay"        value={tenant.autopayEnabled ? 'Enabled' : 'Disabled'} />
              <InfoRow label="Member Since"   value={formatDate(tenant.createdAt)} />
            </CardContent>
          </Card>
        </Grid>

        {/* Lease info */}
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                Active Lease
              </Typography>
              <Divider sx={{ mb: 1.5 }} />
              {lease ? (
                <>
                  <InfoRow label="Unit"         value={unitLabel} />
                  <InfoRow label="Lease Start"  value={formatDate(lease.startDate)} />
                  {lease.endDate && <InfoRow label="Lease End" value={formatDate(lease.endDate)} />}
                  <InfoRow label="Monthly Rate" value={formatMoney(lease.monthlyRate)} />
                  <InfoRow label="Deposit"      value={formatMoney(lease.deposit)} />
                  <InfoRow label="Billing Day"  value={`${lease.billingDay}th of the month`} />
                  <InfoRow label="Status"       value={lease.status} />
                  {lease.moveOutDate && <InfoRow label="Move-Out Date" value={formatDate(lease.moveOutDate)} />}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  No active lease
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Payment history */}
        <Grid item xs={12}>
          <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #EDE5D8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Payment History
                </Typography>
                {lease && (
                  <Button size="small" variant="outlined" startIcon={<PaymentIcon />} onClick={() => setPaymentOpen(true)} sx={{ borderColor: '#EDE5D8' }}>
                    Make Payment
                  </Button>
                )}
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Note</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                          No payments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((p) => {
                        const psc = PAYMENT_STATUS_COLORS[p.status]
                        return (
                          <TableRow key={p._id} hover>
                            <TableCell sx={{ color: 'text.secondary' }}>{formatDate(p.createdAt)}</TableCell>
                            <TableCell sx={{ textTransform: 'capitalize', color: 'text.secondary' }}>
                              {PAYMENT_TYPE_LABELS[p.type] ?? p.type}
                            </TableCell>
                            <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                              {p.description ?? '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 500 }}>
                              {formatMoney(p.amount)}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={p.status}
                                size="small"
                                sx={{
                                  bgcolor: psc.bg, color: psc.color,
                                  fontWeight: 600, fontSize: '0.7rem',
                                  textTransform: 'capitalize', borderRadius: 1,
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Make Payment dialog */}
      {lease && (
        <MakePaymentDialog
          open={paymentOpen}
          tenantId={tenant._id}
          leaseId={lease._id}
          defaultAmount={lease.monthlyRate}
          onClose={() => setPaymentOpen(false)}
          onSuccess={() => {
            setSnackbar('Payment processed successfully')
            fetchData()
          }}
        />
      )}

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
