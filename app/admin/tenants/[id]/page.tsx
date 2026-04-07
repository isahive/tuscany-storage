'use client'

import { useState } from 'react'
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
  Divider,
  Grid,
  IconButton,
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
import ExitToAppIcon from '@mui/icons-material/ExitToApp'
import { useRouter } from 'next/navigation'
import { formatMoney, formatDate } from '@/lib/utils'
import type { TenantStatus, PaymentStatus, EventType } from '@/types'

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

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, { bg: string; color: string }> = {
  succeeded: { bg: '#D1FAE5', color: '#065F46' },
  failed:    { bg: '#FEE2E2', color: '#991B1B' },
  pending:   { bg: '#FEF3C7', color: '#92400E' },
  refunded:  { bg: '#F3F4F6', color: '#374151' },
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_TENANT = {
  id: '2',
  firstName: 'Robert',
  lastName: 'Chen',
  email: 'r.chen@email.com',
  phone: '(512) 555-0102',
  alternatePhone: '(512) 555-0199',
  address: '4821 Ridgecrest Dr',
  city: 'Austin',
  state: 'TX',
  zip: '78731',
  driversLicense: 'TX-DL-889921',
  status: 'locked_out' as TenantStatus,
  autopayEnabled: false,
  smsOptIn: true,
  referralSource: 'Google',
  createdAt: '2025-08-14',
}

const MOCK_LEASE = {
  id: 'lease-1',
  unitNumber: '12A',
  unitSize: '10x15',
  unitType: 'Climate Controlled',
  startDate: '2025-08-14',
  monthlyRate: 12500,
  deposit: 12500,
  billingDay: 14,
  status: 'active',
}

interface PaymentRow {
  id: string
  date: string
  amount: number
  type: string
  status: PaymentStatus
  receiptUrl?: string
}

const MOCK_PAYMENTS: PaymentRow[] = [
  { id: 'p1', date: '2026-03-14', amount: 12500, type: 'rent',     status: 'failed'    },
  { id: 'p2', date: '2026-02-14', amount: 12500, type: 'rent',     status: 'succeeded', receiptUrl: '#' },
  { id: 'p3', date: '2026-01-14', amount: 12500, type: 'rent',     status: 'succeeded', receiptUrl: '#' },
  { id: 'p4', date: '2025-12-14', amount: 12500, type: 'rent',     status: 'succeeded', receiptUrl: '#' },
  { id: 'p5', date: '2025-08-14', amount: 12500, type: 'deposit',  status: 'succeeded', receiptUrl: '#' },
]

interface AccessRow {
  id: string
  date: string
  eventType: EventType
  gate: string
  source: string
}

const MOCK_ACCESS: AccessRow[] = [
  { id: 'a1', date: '2026-03-24T09:14:00Z', eventType: 'denied',       gate: 'entrance', source: 'keypad' },
  { id: 'a2', date: '2026-03-23T17:40:00Z', eventType: 'exit',         gate: 'exit',     source: 'keypad' },
  { id: 'a3', date: '2026-03-23T14:22:00Z', eventType: 'entry',        gate: 'entrance', source: 'keypad' },
  { id: 'a4', date: '2026-03-20T11:05:00Z', eventType: 'code_changed', gate: 'unknown',  source: 'admin'  },
  { id: 'a5', date: '2026-03-19T16:30:00Z', eventType: 'exit',         gate: 'exit',     source: 'keypad' },
]

const EVENT_COLORS: Record<EventType, { bg: string; color: string }> = {
  entry:        { bg: '#D1FAE5', color: '#065F46' },
  exit:         { bg: '#DBEAFE', color: '#1E3A5F' },
  denied:       { bg: '#FEE2E2', color: '#991B1B' },
  code_changed: { bg: '#EDE9FE', color: '#3B0764' },
}

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <Box sx={{ display: 'flex', py: 0.75 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', width: 160, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value ?? '—'}
      </Typography>
    </Box>
  )
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function EditDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = MOCK_TENANT
  const [form, setForm] = useState({
    firstName: t.firstName,
    lastName: t.lastName,
    email: t.email,
    phone: t.phone,
    address: t.address ?? '',
    city: t.city ?? '',
    state: t.state ?? '',
    zip: t.zip ?? '',
  })
  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Edit Tenant Info</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={6}>
            <TextField label="First Name" fullWidth size="small" value={form.firstName} onChange={handleChange('firstName')} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Last Name" fullWidth size="small" value={form.lastName} onChange={handleChange('lastName')} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Email" fullWidth size="small" value={form.email} onChange={handleChange('email')} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Phone" fullWidth size="small" value={form.phone} onChange={handleChange('phone')} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Address" fullWidth size="small" value={form.address} onChange={handleChange('address')} />
          </Grid>
          <Grid item xs={5}>
            <TextField label="City" fullWidth size="small" value={form.city} onChange={handleChange('city')} />
          </Grid>
          <Grid item xs={3}>
            <TextField label="State" fullWidth size="small" value={form.state} onChange={handleChange('state')} />
          </Grid>
          <Grid item xs={4}>
            <TextField label="ZIP" fullWidth size="small" value={form.zip} onChange={handleChange('zip')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" disableElevation onClick={onClose}>Save Changes</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Notification dialog ───────────────────────────────────────────────────────

function NotifyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [message, setMessage] = useState('')
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Send Notification</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <TextField
          label="Message"
          multiline
          rows={4}
          fullWidth
          size="small"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your message…"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" disableElevation onClick={onClose}>Send via Email + SMS</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const router = useRouter()
  const tenant = MOCK_TENANT
  const lease = MOCK_LEASE

  const [editOpen, setEditOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)

  const statusColors = STATUS_COLORS[tenant.status]

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/admin/tenants')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {tenant.firstName} {tenant.lastName}
        </Typography>
        <Chip
          label={STATUS_LABELS[tenant.status]}
          size="small"
          sx={{
            bgcolor: statusColors.bg,
            color: statusColors.color,
            fontWeight: 600,
            fontSize: '0.7rem',
            ml: 0.5,
          }}
        />
      </Box>

      {/* Locked-out alert */}
      {tenant.status === 'locked_out' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          This tenant is currently <strong>locked out</strong>. Gate access has been revoked.
        </Alert>
      )}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {tenant.status === 'locked_out' ? (
          <Button
            variant="outlined"
            startIcon={<LockOpenIcon />}
            color="success"
            onClick={() => {}}
          >
            Restore Access
          </Button>
        ) : (
          <Button
            variant="outlined"
            startIcon={<LockIcon />}
            color="error"
            onClick={() => {}}
          >
            Lock Out
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<NotificationsIcon />}
          onClick={() => setNotifyOpen(true)}
        >
          Send Notification
        </Button>
        <Button
          variant="outlined"
          startIcon={<ExitToAppIcon />}
          color="warning"
          onClick={() => {}}
        >
          Move Out
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Personal info */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Personal Information
                </Typography>
                <IconButton size="small" onClick={() => setEditOpen(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <InfoRow label="Full Name"      value={`${tenant.firstName} ${tenant.lastName}`} />
              <InfoRow label="Email"          value={tenant.email} />
              <InfoRow label="Phone"          value={tenant.phone} />
              <InfoRow label="Alt Phone"      value={tenant.alternatePhone} />
              <InfoRow label="Address"        value={tenant.address} />
              <InfoRow label="City / State"   value={`${tenant.city ?? ''}, ${tenant.state ?? ''} ${tenant.zip ?? ''}`} />
              <InfoRow label="Driver License" value={tenant.driversLicense} />
              <InfoRow label="Referral"       value={tenant.referralSource} />
              <InfoRow label="SMS Opt-In"     value={tenant.smsOptIn ? 'Yes' : 'No'} />
              <InfoRow label="Autopay"        value={tenant.autopayEnabled ? 'Enabled' : 'Disabled'} />
              <InfoRow label="Member Since"   value={formatDate(tenant.createdAt)} />
            </CardContent>
          </Card>
        </Grid>

        {/* Lease info */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Lease Information
              </Typography>
              <Divider sx={{ mb: 1.5 }} />
              <InfoRow label="Unit"          value={`${lease.unitNumber} — ${lease.unitSize} ${lease.unitType}`} />
              <InfoRow label="Lease Start"   value={formatDate(lease.startDate)} />
              <InfoRow label="Lease Type"    value="Month-to-Month" />
              <InfoRow label="Monthly Rate"  value={formatMoney(lease.monthlyRate)} />
              <InfoRow label="Deposit Paid"  value={formatMoney(lease.deposit)} />
              <InfoRow label="Billing Day"   value={`${lease.billingDay}th of the month`} />
              <InfoRow label="Lease Status"  value="Active" />
            </CardContent>
          </Card>
        </Grid>

        {/* Payment history */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #EDE5D8' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Payment History
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="right">Receipt</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {MOCK_PAYMENTS.map((p) => {
                      const sc = PAYMENT_STATUS_COLORS[p.status]
                      return (
                        <TableRow key={p.id} hover>
                          <TableCell>{formatDate(p.date)}</TableCell>
                          <TableCell sx={{ textTransform: 'capitalize', color: 'text.secondary' }}>
                            {p.type}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 500 }}>
                            {formatMoney(p.amount)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={p.status}
                              size="small"
                              sx={{
                                bgcolor: sc.bg,
                                color: sc.color,
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                textTransform: 'capitalize',
                                borderRadius: 1,
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {p.receiptUrl ? (
                              <Button size="small" href={p.receiptUrl} sx={{ fontSize: '0.75rem' }}>
                                Download
                              </Button>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Gate access log */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #EDE5D8' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Gate Access Log
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date / Time</TableCell>
                      <TableCell align="center">Event</TableCell>
                      <TableCell>Gate</TableCell>
                      <TableCell>Source</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {MOCK_ACCESS.map((a) => {
                      const ec = EVENT_COLORS[a.eventType]
                      const label = a.eventType.replace('_', ' ')
                      return (
                        <TableRow key={a.id} hover>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            }).format(new Date(a.date))}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={label}
                              size="small"
                              sx={{
                                bgcolor: ec.bg,
                                color: ec.color,
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                textTransform: 'capitalize',
                                borderRadius: 1,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                            {a.gate}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                            {a.source}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} />
      <NotifyDialog open={notifyOpen} onClose={() => setNotifyOpen(false)} />
    </Box>
  )
}
