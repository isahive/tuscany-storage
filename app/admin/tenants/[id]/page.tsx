'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Avatar,
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
  Grid,
  IconButton,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import PhoneIcon from '@mui/icons-material/Phone'
import HomeIcon from '@mui/icons-material/Home'
import BadgeIcon from '@mui/icons-material/Badge'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import { formatMoney, formatDate } from '@/lib/utils'
import type { TenantStatus } from '@/types'

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TenantStatus, { bg: string; color: string }> = {
  active:      { bg: '#D1FAE5', color: '#065F46' },
  delinquent:  { bg: '#FEF3C7', color: '#92400E' },
  locked_out:  { bg: '#FEE2E2', color: '#991B1B' },
  moved_out:   { bg: '#F3F4F6', color: '#374151' },
}
const STATUS_LABELS: Record<TenantStatus, string> = {
  active: 'Active', delinquent: 'Delinquent', locked_out: 'Locked Out', moved_out: 'Moved Out',
}

// ── Types ───────────────────────────────────────────────────────────────────

interface TenantData {
  _id: string
  firstName: string; lastName: string
  email: string; phone: string
  alternatePhone?: string; alternateEmail?: string
  address?: string; city?: string; state?: string; zip?: string
  driversLicense?: string; idPhotoUrl?: string
  gateCode?: string; status: TenantStatus; role: string
  autopayEnabled: boolean; smsOptIn: boolean
  stripeCustomerId?: string; defaultPaymentMethodId?: string
  createdAt: string; updatedAt: string
}

interface LeaseData {
  _id: string; unitId: { _id: string; unitNumber: string; size?: string } | string
  startDate: string; endDate?: string; monthlyRate: number
  deposit: number; billingDay: number; status: string
  signedAt?: string
}

interface PaymentData {
  _id: string; amount: number; type: string; status: string
  periodStart: string; periodEnd: string; createdAt: string
}

interface NoteData {
  _id: string; content: string; createdBy: string
  attachmentUrl?: string; attachmentName?: string; createdAt: string
}

// ── Info row component ──────────────────────────────────────────────────────

function InfoRow({ label, value, icon, href }: {
  label: string; value: string; icon?: React.ReactNode; href?: string
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 1.2, borderBottom: '1px solid #F3F0EB' }}>
      {icon && <Box sx={{ mr: 1.5, color: 'text.secondary', display: 'flex' }}>{icon}</Box>}
      <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 120, fontWeight: 500 }}>
        {label}
      </Typography>
      {href ? (
        <MuiLink href={href} variant="body2" sx={{ color: 'primary.main' }}>
          {value}
        </MuiLink>
      ) : (
        <Typography variant="body2" sx={{ color: '#1C0F06' }}>
          {value || '—'}
        </Typography>
      )}
    </Box>
  )
}

// ── Edit Profile Dialog ─────────────────────────────────────────────────────

function EditProfileDialog({ open, onClose, tenant, onSaved }: {
  open: boolean; onClose: () => void; tenant: TenantData; onSaved: () => void
}) {
  const [form, setForm] = useState({
    firstName: tenant.firstName,
    lastName: tenant.lastName,
    email: tenant.email,
    phone: tenant.phone,
    alternatePhone: tenant.alternatePhone ?? '',
    alternateEmail: tenant.alternateEmail ?? '',
    address: tenant.address ?? '',
    city: tenant.city ?? '',
    state: tenant.state ?? '',
    zip: tenant.zip ?? '',
    driversLicense: tenant.driversLicense ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm({
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      email: tenant.email,
      phone: tenant.phone,
      alternatePhone: tenant.alternatePhone ?? '',
      alternateEmail: tenant.alternateEmail ?? '',
      address: tenant.address ?? '',
      city: tenant.city ?? '',
      state: tenant.state ?? '',
      zip: tenant.zip ?? '',
      driversLicense: tenant.driversLicense ?? '',
    })
  }, [tenant])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/tenants/${tenant._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to update')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Edit Profile</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={6}>
            <TextField label="First Name" fullWidth size="small" value={form.firstName} onChange={set('firstName')} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Last Name" fullWidth size="small" value={form.lastName} onChange={set('lastName')} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Email" fullWidth size="small" value={form.email} onChange={set('email')} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Phone" fullWidth size="small" value={form.phone} onChange={set('phone')} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Alt Phone" fullWidth size="small" value={form.alternatePhone} onChange={set('alternatePhone')} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Alt Email" fullWidth size="small" value={form.alternateEmail} onChange={set('alternateEmail')} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Address" fullWidth size="small" value={form.address} onChange={set('address')} />
          </Grid>
          <Grid item xs={5}>
            <TextField label="City" fullWidth size="small" value={form.city} onChange={set('city')} />
          </Grid>
          <Grid item xs={3}>
            <TextField label="State" fullWidth size="small" value={form.state} onChange={set('state')} />
          </Grid>
          <Grid item xs={4}>
            <TextField label="ZIP" fullWidth size="small" value={form.zip} onChange={set('zip')} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Driver's License #" fullWidth size="small" value={form.driversLicense} onChange={set('driversLicense')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} disableElevation>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [tenant, setTenant] = useState<TenantData | null>(null)
  const [leases, setLeases] = useState<LeaseData[]>([])
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [notes, setNotes] = useState<NoteData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [editOpen, setEditOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [tRes, lRes, pRes, nRes, bRes] = await Promise.all([
        fetch(`/api/tenants/${tenantId}`),
        fetch(`/api/leases?tenantId=${tenantId}&limit=50`),
        fetch(`/api/payments?tenantId=${tenantId}&limit=100`),
        fetch(`/api/tenants/${tenantId}/notes`),
        fetch(`/api/tenants/${tenantId}/balance`),
      ])
      const [tJson, lJson, pJson, nJson, bJson] = await Promise.all([
        tRes.json(), lRes.json(), pRes.json(), nRes.json(), bRes.json(),
      ])

      if (!tJson.success) throw new Error(tJson.error ?? 'Tenant not found')
      setTenant(tJson.data)
      setLeases(lJson.success ? (lJson.data?.items ?? []) : [])
      setPayments(pJson.success ? (pJson.data?.items ?? []) : [])
      setNotes(nJson.success ? nJson.data : [])
      if (bJson.success) setBalance(bJson.data.balance)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant')
    } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { loadData() }, [loadData])

  async function handleStatusToggle() {
    if (!tenant) return
    const newStatus: TenantStatus = tenant.status === 'locked_out' ? 'active' : 'locked_out'
    await fetch(`/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    loadData()
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    setNoteSaving(true)
    try {
      await fetch(`/api/tenants/${tenantId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteText }),
      })
      setNoteText('')
      loadData()
    } finally { setNoteSaving(false) }
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}>
      <CircularProgress />
    </Box>
  )

  if (error || !tenant) return (
    <Box sx={{ py: 8, textAlign: 'center' }}>
      <Typography color="error" sx={{ mb: 2 }}>{error ?? 'Tenant not found'}</Typography>
      <Button onClick={() => router.push('/admin/tenants')}>Back to Tenants</Button>
    </Box>
  )

  const fullName = `${tenant.firstName} ${tenant.lastName}`
  const fullAddress = [tenant.address, tenant.city, tenant.state, tenant.zip].filter(Boolean).join(', ')
  const activeLease = leases.find((l) => l.status === 'active' || l.status === 'pending_moveout')
  const activeUnit = activeLease && typeof activeLease.unitId === 'object' ? activeLease.unitId.unitNumber : '—'
  const statusC = STATUS_COLORS[tenant.status]
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => router.push('/admin/tenants')}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1C0F06', fontFamily: '"Playfair Display", serif' }}>
            {fullName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
            <Chip label={STATUS_LABELS[tenant.status]} size="small" sx={{ bgcolor: statusC.bg, color: statusC.color, fontWeight: 600, fontSize: '0.7rem' }} />
            {activeUnit !== '—' && <Typography variant="body2" sx={{ color: 'text.secondary' }}>Unit {activeUnit}</Typography>}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>
            Edit Profile
          </Button>
          <Tooltip title={tenant.status === 'locked_out' ? 'Unlock Tenant' : 'Lock Out Tenant'}>
            <Button
              variant="outlined" size="small" color={tenant.status === 'locked_out' ? 'success' : 'error'}
              startIcon={tenant.status === 'locked_out' ? <LockOpenIcon /> : <LockIcon />}
              onClick={handleStatusToggle}
            >
              {tenant.status === 'locked_out' ? 'Unlock' : 'Lock Out'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Left column: ID Photo + Balance */}
        <Grid item xs={12} md={4}>
          {/* ID Photo */}
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              {tenant.idPhotoUrl ? (
                <Box sx={{ borderRadius: 2, overflow: 'hidden', mb: 1 }}>
                  <img
                    src={tenant.idPhotoUrl}
                    alt="ID Photo"
                    style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 8 }}
                  />
                </Box>
              ) : (
                <Avatar
                  sx={{ width: 120, height: 120, mx: 'auto', mb: 1, bgcolor: '#EDE5D8', color: '#1C0F06', fontSize: 40, fontWeight: 700 }}
                >
                  {tenant.firstName[0]}{tenant.lastName[0]}
                </Avatar>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {tenant.idPhotoUrl ? 'Photo ID on file' : 'No ID photo on file'}
              </Typography>
            </CardContent>
          </Card>

          {/* Balance */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Balance: {formatMoney(balance)}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Outstanding</Typography>
                <Typography variant="body2" sx={{ color: balance > 0 ? '#DC2626' : '#065F46', fontWeight: 600 }}>
                  {formatMoney(balance)}
                </Typography>
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Autopay</Typography>
                <Chip
                  label={tenant.autopayEnabled ? 'Active' : 'Off'}
                  size="small"
                  sx={{
                    bgcolor: tenant.autopayEnabled ? '#D1FAE5' : '#F3F4F6',
                    color: tenant.autopayEnabled ? '#065F46' : '#374151',
                    fontWeight: 600, fontSize: '0.7rem',
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right column: Info + Rentals + Billing + Notes */}
        <Grid item xs={12} md={8}>
          {/* Customer Information */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Customer Information
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>Contact</Typography>
                  <InfoRow label="Name" value={fullName} icon={<BadgeIcon fontSize="small" />} />
                  <InfoRow label="Email" value={tenant.email} icon={<MailOutlineIcon fontSize="small" />} href={`mailto:${tenant.email}`} />
                  <InfoRow label="Phone" value={tenant.phone} icon={<PhoneIcon fontSize="small" />} href={`tel:${tenant.phone}`} />
                  {tenant.alternatePhone && <InfoRow label="Alt Phone" value={tenant.alternatePhone} icon={<PhoneIcon fontSize="small" />} />}
                  {tenant.alternateEmail && <InfoRow label="Alt Email" value={tenant.alternateEmail} icon={<MailOutlineIcon fontSize="small" />} />}
                  <InfoRow label="Address" value={fullAddress || '—'} icon={<HomeIcon fontSize="small" />} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>Account & Access</Typography>
                  <InfoRow label="Login" value="Enabled" />
                  <InfoRow label="Access Code" value={tenant.gateCode ?? 'None'} />
                  <InfoRow label="Driver's License" value={tenant.driversLicense ?? '—'} />
                  <InfoRow label="SMS Opt-In" value={tenant.smsOptIn ? 'Yes' : 'No'} />
                  <InfoRow label="Payment Method" value={tenant.defaultPaymentMethodId ? 'Card on file' : 'None'}
                    icon={<CreditCardIcon fontSize="small" />} />
                </Grid>
              </Grid>

              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', mt: 2 }}>
                Created {formatDate(tenant.createdAt)}
              </Typography>
            </CardContent>
          </Card>

          {/* Rentals */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Rentals
              </Typography>
              {leases.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  This customer does not currently have any rentals.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' } }}>
                        <TableCell>Unit</TableCell>
                        <TableCell>Start Date</TableCell>
                        <TableCell>Rate</TableCell>
                        <TableCell>Billing Day</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Signed</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leases.map((l) => {
                        const unitLabel = typeof l.unitId === 'object' ? l.unitId.unitNumber : l.unitId
                        return (
                          <TableRow key={l._id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{unitLabel}</Typography>
                            </TableCell>
                            <TableCell>{formatDate(l.startDate)}</TableCell>
                            <TableCell>{formatMoney(l.monthlyRate)}/mo</TableCell>
                            <TableCell>{l.billingDay}</TableCell>
                            <TableCell>
                              <Chip label={l.status} size="small" sx={{ fontSize: '0.7rem', fontWeight: 600 }} />
                            </TableCell>
                            <TableCell>
                              {l.signedAt ? formatDate(l.signedAt) : <Typography variant="body2" color="warning.main">Unsigned</Typography>}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Billing History */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Billing History
              </Typography>
              {payments.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No billing history yet.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' } }}>
                        <TableCell>Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Period</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p._id}>
                          <TableCell>{formatDate(p.createdAt)}</TableCell>
                          <TableCell sx={{ textTransform: 'capitalize' }}>{p.type.replace('_', ' ')}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{formatMoney(p.amount)}</TableCell>
                          <TableCell>
                            <Chip
                              label={p.status}
                              size="small"
                              sx={{
                                fontSize: '0.7rem', fontWeight: 600,
                                bgcolor: p.status === 'succeeded' ? '#D1FAE5' : p.status === 'failed' ? '#FEE2E2' : '#FEF3C7',
                                color: p.status === 'succeeded' ? '#065F46' : p.status === 'failed' ? '#991B1B' : '#92400E',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>
                            {formatDate(p.periodStart)} — {formatDate(p.periodEnd)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Notes
              </Typography>

              {notes.map((n) => (
                <Box key={n._id} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #F3F0EB' }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>{n.content}</Typography>
                  {n.attachmentUrl && (
                    <MuiLink href={n.attachmentUrl} target="_blank" variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <AttachFileIcon sx={{ fontSize: 14 }} /> {n.attachmentName ?? 'Attachment'}
                    </MuiLink>
                  )}
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {formatDate(n.createdAt)} by {n.createdBy}
                  </Typography>
                </Box>
              ))}

              <Box sx={{ mt: 2 }}>
                <TextField
                  multiline rows={3} fullWidth size="small"
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  sx={{ mb: 1.5 }}
                />
                <Button
                  variant="contained" size="small" disableElevation
                  onClick={handleAddNote}
                  disabled={noteSaving || !noteText.trim()}
                >
                  {noteSaving ? 'Saving...' : 'Create Note'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit dialog */}
      <EditProfileDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        tenant={tenant}
        onSaved={loadData}
      />
    </Box>
  )
}
