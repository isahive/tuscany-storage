'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import { formatMoney, formatDate } from '@/lib/utils'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'
import LinkedAccountsBanner from '@/components/admin/LinkedAccountsBanner'
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
  // Primary address
  address?: string; city?: string; state?: string; zip?: string
  // Alternate contact
  alternateContactName?: string
  alternatePhone?: string
  alternateEmail?: string
  alternateAddress?: string
  alternateCity?: string
  alternateState?: string
  alternateZip?: string
  // Personal info
  driversLicense?: string
  driversLicenseNumber?: string
  driversLicenseState?: string
  ssn?: string
  employerName?: string
  employerPhone?: string
  emergencyContact?: string
  emergencyPhone?: string
  securityQuestion?: string
  securityAnswer?: string
  idPhotoUrl?: string
  // Other
  referralSource?: string
  howDidYouHear?: string
  howDidYouHearOther?: string
  gateCode?: string; status: TenantStatus; role: string
  autopayEnabled: boolean; smsOptIn: boolean
  stripeCustomerId?: string; defaultPaymentMethodId?: string
  customFields?: Record<string, string>
  createdAt: string; updatedAt: string
}

interface LeaseData {
  _id: string; unitId: { _id: string; unitNumber: string; size?: string; type?: string } | string
  startDate: string; endDate?: string; monthlyRate: number
  deposit: number; billingDay: number; status: string
  signedAt?: string
  exemptFromRateManagement?: boolean
  appliedPromotionId?: {
    _id: string
    name: string
    description?: string
    method: 'manual' | 'promo_code' | 'automatic'
    discountType: 'percentage' | 'fixed'
    discountValue: number
    noExpiration: boolean
    durationCycles: number
    status: 'active' | 'retired'
  } | string | null
}

interface PaymentData {
  _id: string; amount: number; type: string; status: string
  direction?: 'charge' | 'payment'
  balanceAfter?: number
  periodStart?: string; periodEnd?: string; createdAt: string
  description?: string; dueDate?: string
}

// Maps the raw PaymentType enum to the human label shown in the Item column —
// "late_fee" was bleeding through as a slug, which is what Silvio flagged.
const PAYMENT_ITEM_LABELS: Record<string, string> = {
  rent: 'Monthly Rent',
  late_fee: 'Past Due Fee',
  deposit: 'Security Deposit',
  prorated: 'Prorated Rent',
  credit: 'Credit',
  other: 'Fee',
}

function paymentItemLabel(p: PaymentData): string {
  // Payment-direction rows show the method (Cash, Credit Card, Void, …),
  // parsed from the description prefix written by apply-payment. Falls back
  // to a generic "Payment" label.
  if (p.direction === 'payment') {
    if (p.status === 'voided') return 'Void'
    if (p.type === 'credit') return 'Credit'
    if (p.status === 'refunded') return 'Refund'
    const prefix = p.description?.split('—')[0]?.trim()
    return prefix || 'Payment'
  }
  return PAYMENT_ITEM_LABELS[p.type] ?? p.type
}

function paymentDescription(p: PaymentData): string {
  if (p.description) return p.description
  if (p.periodStart && p.periodEnd) {
    return `Period: ${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`
  }
  if (p.dueDate) return `Due ${formatDate(p.dueDate)}`
  return ''
}

// Treat money-moved rows (payments received, credits issued, refunds, voids)
// as belonging to the Payments/Voids column instead of Charges.
// Note: a CHARGE row with status='voided' still shows in the Charges column —
// the matching payment-direction void row is what surfaces in Payments/Voids.
function isCreditEntry(p: PaymentData): boolean {
  if (p.direction === 'payment') return true
  return p.type === 'credit' || p.status === 'refunded' || p.amount < 0
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
  const [outstanding, setOutstanding] = useState<number>(0)
  const [credit, setCredit] = useState<number>(0)
  const [recurringBillingActive, setRecurringBillingActive] = useState<boolean>(false)
  const [recurringFeesCount, setRecurringFeesCount] = useState<number>(0)
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [showExtended, setShowExtended] = useState(false)

  // Publish title for breadcrumb (shows the customer name instead of the raw ID)
  useSetAdminPageTitle(tenant ? `${tenant.firstName} ${tenant.lastName}` : null)

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
      if (bJson.success) {
        setBalance(bJson.data.balance)
        setOutstanding(bJson.data.outstanding ?? 0)
        setCredit(bJson.data.credit ?? 0)
        setRecurringBillingActive(!!bJson.data.recurringBillingActive)
        setRecurringFeesCount(bJson.data.recurringFeesCount ?? 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant')
    } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { loadData() }, [loadData])

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
      <LinkedAccountsBanner tenantId={tenantId} />
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <IconButton aria-label="Back to customers list" onClick={() => router.push('/admin/tenants')}>
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
      </Box>

      {/* Action buttons row — matches live admin */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {[
          { label: 'Recurring Billing',  onClick: () => router.push(`/admin/tenants/${tenantId}/recurring-billing`) },
          { label: 'Add Credit',          onClick: () => router.push(`/admin/tenants/${tenantId}/add-credit`) },
          { label: 'Fees/Products',       onClick: () => router.push(`/admin/tenants/${tenantId}/fees-products`) },
          { label: 'Make a Payment',      onClick: () => router.push(`/admin/tenants/${tenantId}/make-payment`) },
          { label: 'Edit Profile',        onClick: () => router.push(`/admin/tenants/${tenantId}/edit`) },
          { label: 'Rent Unit',           onClick: () => router.push(`/admin/tenants/${tenantId}/rent-unit`) },
          { label: 'Reserve Unit',        onClick: () => router.push(`/admin/tenants/${tenantId}/reserve-unit`) },
          { label: 'Letters',             onClick: () => router.push(`/admin/tenants/${tenantId}/letters`) },
          { label: 'Gate Access',         onClick: () => router.push(`/admin/tenants/${tenantId}/gate-access`) },
        ].map((b) => (
          <Button
            key={b.label}
            variant="contained"
            size="small"
            onClick={b.onClick}
            disableElevation
            sx={{
              bgcolor: '#8CA87C',
              color: 'white',
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.78rem',
              px: 1.75,
              py: 0.75,
              '&:hover': { bgcolor: '#7E9770' },
            }}
          >
            {b.label}
          </Button>
        ))}
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
            <Box sx={{ bgcolor: '#F3F4F6', px: 2.5, py: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Balance: {formatMoney(balance)}
              </Typography>
            </Box>
            <Box>
              {/* Row: Outstanding */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.2fr', alignItems: 'center', borderBottom: '1px solid #F3F0EB' }}>
                <Typography variant="body2" sx={{ px: 2.5, py: 1.5, color: 'text.secondary' }}>Outstanding</Typography>
                <Typography variant="body2" sx={{ px: 2.5, py: 1.5, bgcolor: outstanding > 0 ? '#FEE2E2' : '#FEF3C7', fontWeight: 600, textAlign: 'left' }}>
                  {formatMoney(outstanding)}
                </Typography>
                <Box sx={{ px: 2.5, py: 1.5 }}>
                  <MuiLink
                    component="button"
                    variant="body2"
                    onClick={() => router.push(`/admin/tenants/${tenantId}/make-payment`)}
                    sx={{ color: '#3F8EBF', fontWeight: 500 }}
                  >
                    Make a Payment
                  </MuiLink>
                </Box>
              </Box>

              {/* Row: Credit */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.2fr', alignItems: 'center', borderBottom: '1px solid #F3F0EB' }}>
                <Typography variant="body2" sx={{ px: 2.5, py: 1.5, color: 'text.secondary' }}>Credit</Typography>
                <Typography variant="body2" sx={{ px: 2.5, py: 1.5, bgcolor: '#D1FAE5', fontWeight: 600, textAlign: 'left' }}>
                  {formatMoney(credit)}
                </Typography>
                <Box sx={{ px: 2.5, py: 1.5 }}>
                  <MuiLink
                    component="button"
                    variant="body2"
                    onClick={() => router.push(`/admin/tenants/${tenantId}/add-credit`)}
                    sx={{ color: '#3F8EBF', fontWeight: 500 }}
                  >
                    Add Credit
                  </MuiLink>
                </Box>
              </Box>

              {/* Row: Recurring Billing (visual gap matches live) */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.2fr', alignItems: 'center', borderBottom: '1px solid #F3F0EB', mt: 1 }}>
                <Typography variant="body2" sx={{ px: 2.5, py: 1.5, color: 'text.secondary' }}>Recurring Billing</Typography>
                <Typography variant="body2" sx={{ px: 2.5, py: 1.5, bgcolor: '#D1FAE5', fontWeight: 600, textAlign: 'left' }}>
                  {recurringBillingActive ? 'Active' : 'Inactive'}
                </Typography>
                <Box sx={{ px: 2.5, py: 1.5 }}>
                  <MuiLink
                    component="button"
                    variant="body2"
                    onClick={() => router.push(`/admin/tenants/${tenantId}/recurring-billing`)}
                    sx={{ color: '#3F8EBF', fontWeight: 500 }}
                  >
                    Edit Recurring Billing
                  </MuiLink>
                </Box>
              </Box>

              {/* Row: Recurring Fees */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.2fr', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ px: 2.5, py: 1.5, color: 'text.secondary' }}>Recurring Fees</Typography>
                <Typography variant="body2" sx={{ px: 2.5, py: 1.5, bgcolor: '#D1FAE5', fontWeight: 600, textAlign: 'left' }}>
                  {recurringFeesCount}
                </Typography>
                <Box sx={{ px: 2.5, py: 1.5 }}>
                  <MuiLink
                    component="button"
                    variant="body2"
                    onClick={() => router.push(`/admin/tenants/${tenantId}/recurring-fees`)}
                    sx={{ color: '#3F8EBF', fontWeight: 500 }}
                  >
                    Edit Recurring Fees
                  </MuiLink>
                </Box>
              </Box>
            </Box>
          </Card>
        </Grid>

        {/* Right column: Info + Rentals + Billing + Notes */}
        <Grid item xs={12} md={8}>
          {/* Customer Information */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Customer Information
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 700 }}>
                    Contact
                  </Typography>
                  <InfoRow label="Name" value={fullName} />
                  <InfoRow
                    label="Email"
                    value={tenant.email}
                    href={`mailto:${tenant.email}`}
                  />
                  <InfoRow label="Phone" value={tenant.alternatePhone || '—'} />
                  <InfoRow
                    label="Cell Phone"
                    value={tenant.phone || '—'}
                    href={tenant.phone ? `tel:${tenant.phone}` : undefined}
                  />
                  <InfoRow label="Address" value={fullAddress || '—'} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 700 }}>
                    Account &amp; Access
                  </Typography>
                  <InfoRow label="Login" value={tenant.status === 'locked_out' ? 'Disabled' : 'Enabled'} />
                  <InfoRow label="Username" value={tenant.email} />
                  <InfoRow label="Security question" value={tenant.securityQuestion || '—'} />
                  <InfoRow label="Security answer" value={tenant.securityAnswer ? '••••••••' : '—'} />
                  <InfoRow label="Access Code" value={tenant.gateCode || 'None'} />
                </Grid>
              </Grid>

              {/* Show Extended Information toggle */}
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setShowExtended((v) => !v)}
                  sx={{ color: '#1d4ed8', textTransform: 'none', fontWeight: 500 }}
                >
                  {showExtended ? 'Hide Extended Information −' : 'Show Extended Information +'}
                </Button>
              </Box>

              {showExtended && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}
                      >
                        Alternate Contact Information
                      </Typography>
                      <InfoRow label="Contact" value={tenant.alternateContactName || '—'} />
                      <InfoRow label="Address" value={tenant.alternateAddress || '—'} />
                      <InfoRow label="City" value={tenant.alternateCity || '—'} />
                      <InfoRow label="State/Province" value={tenant.alternateState || '—'} />
                      <InfoRow label="Zip/Postal Code" value={tenant.alternateZip || '—'} />
                      <InfoRow
                        label="Phone Number"
                        value={tenant.alternatePhone || '—'}
                        href={tenant.alternatePhone ? `tel:${tenant.alternatePhone}` : undefined}
                      />
                      <InfoRow
                        label="Email"
                        value={tenant.alternateEmail || '—'}
                        href={tenant.alternateEmail ? `mailto:${tenant.alternateEmail}` : undefined}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}
                      >
                        Personal Information
                      </Typography>
                      <InfoRow
                        label="Drivers license number"
                        value={tenant.driversLicenseNumber || tenant.driversLicense || '—'}
                      />
                      <InfoRow
                        label="Drivers license state"
                        value={tenant.driversLicenseState || '—'}
                      />
                      <InfoRow label="Social security number" value={tenant.ssn || '—'} />
                      <InfoRow
                        label="Employer"
                        value={tenant.employerName || '—'}
                      />
                      <InfoRow
                        label="Emergency"
                        value={tenant.emergencyContact || '—'}
                      />
                      <InfoRow label="Source" value={tenant.referralSource || 'Website'} />
                    </Grid>
                  </Grid>

                  {/* Additional Information — full width sub-section */}
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, mt: 3, mb: 1, color: 'text.primary' }}
                  >
                    Additional Information
                  </Typography>
                  <InfoRow
                    label="How did you hear about us?"
                    value={tenant.howDidYouHear || tenant.howDidYouHearOther || '—'}
                  />
                </>
              )}

              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => router.push(`/admin/tenants/${tenantId}/edit`)}
                  disableElevation
                  sx={{ bgcolor: '#8CA87C', '&:hover': { bgcolor: '#7E9770' }, textTransform: 'none' }}
                >
                  Edit Profile
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<MarkEmailReadIcon />}
                  onClick={() => router.push(`/admin/tenants/${tenantId}?tab=notifications`)}
                  disableElevation
                  sx={{ bgcolor: '#8CA87C', '&:hover': { bgcolor: '#7E9770' }, textTransform: 'none' }}
                >
                  Notification Preferences
                </Button>
              </Box>

              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', mt: 2 }}>
                Created {formatDate(tenant.createdAt)} by {fullName}
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
                        <TableCell>Promotion</TableCell>
                        <TableCell>Rate Mgmt</TableCell>
                        <TableCell>Signed</TableCell>
                        <TableCell align="right">Agreement</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leases.map((l) => {
                        const unitLabel = typeof l.unitId === 'object' ? l.unitId.unitNumber : l.unitId
                        const unitType = typeof l.unitId === 'object' ? l.unitId.type : undefined
                        const promo = typeof l.appliedPromotionId === 'object' ? l.appliedPromotionId : null
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
                              {promo ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Tooltip title={promo.description ?? ''}>
                                    <Chip
                                      label={promo.name}
                                      size="small"
                                      sx={{ fontSize: '0.7rem', fontWeight: 600, bgcolor: '#D1FAE5', color: '#065F46' }}
                                    />
                                  </Tooltip>
                                  <Tooltip title="Remove promotion">
                                    <IconButton
                                      size="small"
                                      onClick={async () => {
                                        if (!confirm(`Remove "${promo.name}" from unit ${unitLabel}?`)) return
                                        const res = await fetch(`/api/admin/leases/${l._id}/remove-promotion`, { method: 'POST' })
                                        const json = await res.json().catch(() => ({}))
                                        if (!res.ok || !json.success) alert(json.error ?? 'Failed')
                                        else window.location.reload()
                                      }}
                                    >
                                      <CloseIcon fontSize="small" sx={{ color: '#EF4444' }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              ) : l.status === 'active' ? (
                                <Tooltip title="Add a promotion to this rental">
                                  <Button
                                    size="small"
                                    startIcon={<AddIcon fontSize="small" />}
                                    onClick={async () => {
                                      const res = await fetch('/api/promotions')
                                      const json = await res.json().catch(() => ({}))
                                      if (!res.ok || !json.success) { alert('Failed to load promotions'); return }
                                      const candidates = (json.data ?? []).filter((p: any) =>
                                        p.status === 'active'
                                        && (p.allUnitTypes || (unitType && p.unitTypes?.includes(unitType)))
                                        && (!p.endDate || p.noExpiration || new Date(p.endDate) >= new Date()),
                                      )
                                      if (candidates.length === 0) { alert('No promotions available for this unit type.'); return }
                                      const labels = candidates.map((p: any, i: number) => `${i + 1}. ${p.name} (${p.method})`).join('\n')
                                      const pick = prompt(`Select a promotion:\n${labels}\n\nEnter number:`)
                                      const idx = parseInt(pick ?? '', 10) - 1
                                      if (!candidates[idx]) return
                                      const addRes = await fetch(`/api/admin/leases/${l._id}/add-promotion`, {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ promotionId: candidates[idx]._id }),
                                      })
                                      const addJson = await addRes.json().catch(() => ({}))
                                      if (!addRes.ok || !addJson.success) alert(addJson.error ?? 'Failed')
                                      else window.location.reload()
                                    }}
                                    sx={{ textTransform: 'none', fontSize: '0.7rem', color: '#B8914A' }}
                                  >
                                    Add
                                  </Button>
                                </Tooltip>
                              ) : (
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {/* Storable: exempt toggle is reached via
                                  Customer Profile → Rentals → Edit Billing.
                                  We surface it inline so an admin can flip
                                  it without leaving the page. */}
                              <Tooltip title={l.exemptFromRateManagement
                                ? 'Exempt from Rate Management — click to unexempt'
                                : 'Subject to Rate Management — click to exempt'}>
                                <Button
                                  size="small"
                                  variant={l.exemptFromRateManagement ? 'outlined' : 'text'}
                                  onClick={async () => {
                                    const next = !l.exemptFromRateManagement
                                    const msg = next
                                      ? `Exempt unit ${unitLabel} from Rate Management?`
                                      : `Stop exempting unit ${unitLabel} from Rate Management?`
                                    if (!confirm(msg)) return
                                    const res = await fetch(`/api/admin/leases/${l._id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ exemptFromRateManagement: next }),
                                    })
                                    const json = await res.json().catch(() => ({}))
                                    if (!res.ok || !json.success) alert(json.error ?? 'Failed')
                                    else window.location.reload()
                                  }}
                                  sx={{
                                    textTransform: 'none', fontSize: '0.7rem',
                                    color: l.exemptFromRateManagement ? '#9A3412' : '#65A30D',
                                    borderColor: l.exemptFromRateManagement ? '#FED7AA' : undefined,
                                  }}
                                >
                                  {l.exemptFromRateManagement ? 'Exempt' : 'Subject'}
                                </Button>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              {l.signedAt ? formatDate(l.signedAt) : <Typography variant="body2" color="warning.main">Unsigned</Typography>}
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Email Storage Agreement to customer">
                                <IconButton
                                  size="small"
                                  onClick={async () => {
                                    if (!confirm('Email the Storage Agreement to this customer?')) return
                                    const res = await fetch(`/api/admin/leases/${l._id}/send-agreement`, { method: 'POST' })
                                    const json = await res.json().catch(() => ({}))
                                    if (!res.ok || !json.success) alert(json.error ?? 'Failed to send')
                                    else alert('Agreement sent.')
                                  }}
                                >
                                  <MailOutlineIcon fontSize="small" sx={{ color: '#3B82F6' }} />
                                </IconButton>
                              </Tooltip>
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
                        <TableCell>Item</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Charges</TableCell>
                        <TableCell align="right">Payments/Voids</TableCell>
                        <TableCell align="right">Balance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        // Sort newest→oldest and take the latest 10. balanceAfter
                        // is persisted on each row at write time, so we don't
                        // need to walk the full ledger to know the per-row
                        // balance — the row knows its own.
                        const rows = [...payments]
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .slice(0, 10)
                          .map((p) => {
                            const credit = isCreditEntry(p)
                            const isFailed = p.status === 'failed'
                            const charges = credit ? 0 : Math.abs(p.amount)
                            const paymentsVoids = credit ? Math.abs(p.amount) : 0
                            return { p, charges, paymentsVoids, balance: p.balanceAfter ?? 0, credit, isFailed }
                          })
                        return rows
                          .map(({ p, charges, paymentsVoids, balance: rowBal, credit, isFailed }) => (
                            <TableRow key={p._id}>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <MuiLink
                                  component="button"
                                  onClick={() => router.push(`/admin/tenants/${tenantId}/transaction/${p._id}`)}
                                  sx={{ color: '#DC2626', fontWeight: 500 }}
                                >
                                  {formatDate(p.createdAt)}
                                </MuiLink>
                              </TableCell>
                              <TableCell>{paymentItemLabel(p)}</TableCell>
                              <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                                {paymentDescription(p) || '—'}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 500 }}>
                                {charges > 0 ? formatMoney(charges) : '—'}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ fontWeight: 500, color: credit ? '#DC2626' : 'inherit' }}
                              >
                                {paymentsVoids > 0 ? (
                                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, justifyContent: 'flex-end' }}>
                                    {formatMoney(paymentsVoids)}
                                    {p.status === 'voided' && (
                                      <Chip
                                        label="VOID"
                                        size="small"
                                        sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 700, fontSize: '0.65rem', height: 18 }}
                                      />
                                    )}
                                    {p.status === 'refunded' && (
                                      <Chip
                                        label="REFUND"
                                        size="small"
                                        sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: '0.65rem', height: 18 }}
                                      />
                                    )}
                                    {p.status === 'failed' && (
                                      <Chip
                                        label="FAILED"
                                        size="small"
                                        sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 700, fontSize: '0.65rem', height: 18 }}
                                      />
                                    )}
                                  </Box>
                                ) : '—'}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {formatMoney(rowBal)}
                              </TableCell>
                            </TableRow>
                          ))
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => router.push(`/admin/tenants/${tenantId}/billing-history`)}
                  sx={{ textTransform: 'none', borderColor: '#8CA87C', color: '#5C7350' }}
                >
                  Full Billing &amp; Payments Report
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => router.push(`/admin/tenants/${tenantId}/mass-void`)}
                  sx={{ textTransform: 'none', borderColor: '#DC2626', color: '#DC2626' }}
                >
                  Mass Void Unpaid Line Items
                </Button>
              </Box>
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

    </Box>
  )
}
