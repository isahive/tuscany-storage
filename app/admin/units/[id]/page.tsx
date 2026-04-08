'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Skeleton,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import PersonIcon from '@mui/icons-material/Person'
import HomeIcon from '@mui/icons-material/Home'
import ReceiptIcon from '@mui/icons-material/Receipt'
import type { UnitStatus, UnitType, LeaseStatus, PaymentStatus, TenantStatus } from '@/types'
import { formatMoney, formatDate } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PopulatedTenant {
  _id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  alternatePhone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  driversLicense?: string
  status: TenantStatus
}

interface PopulatedLease {
  _id: string
  startDate: string
  endDate?: string
  moveOutDate?: string
  monthlyRate: number
  deposit: number
  billingDay: number
  status: LeaseStatus
}

interface PopulatedUnit {
  _id: string
  unitNumber: string
  size: string
  width: number
  depth: number
  sqft: number
  type: UnitType
  floor: 'ground' | 'upper'
  price: number
  status: UnitStatus
  features: string[]
  gateCode?: string
  notes?: string
  currentTenantId?: PopulatedTenant | string
  currentLeaseId?: PopulatedLease | string
  createdAt: string
  updatedAt: string
}

interface PaymentItem {
  _id: string
  amount: number
  status: PaymentStatus
  createdAt: string
  periodStart: string
}

// ── Status configs ─────────────────────────────────────────────────────────────

const UNIT_STATUS_COLORS: Record<UnitStatus, { bg: string; color: string; border: string }> = {
  available:   { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
  occupied:    { bg: '#DBEAFE', color: '#1E3A5F', border: '#93C5FD' },
  maintenance: { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
  reserved:    { bg: '#EDE9FE', color: '#3B0764', border: '#C4B5FD' },
}

const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  available:   'Available',
  occupied:    'Occupied',
  maintenance: 'Maintenance',
  reserved:    'Reserved',
}

const TENANT_STATUS_COLORS: Record<TenantStatus, { bg: string; color: string }> = {
  active:      { bg: '#D1FAE5', color: '#065F46' },
  delinquent:  { bg: '#FEF3C7', color: '#92400E' },
  locked_out:  { bg: '#FEE2E2', color: '#991B1B' },
  moved_out:   { bg: '#F3F4F6', color: '#374151' },
}

const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  active:     'Active',
  delinquent: 'Delinquent',
  locked_out: 'Locked Out',
  moved_out:  'Moved Out',
}

const LEASE_STATUS_COLORS: Record<LeaseStatus, { bg: string; color: string }> = {
  active:          { bg: '#D1FAE5', color: '#065F46' },
  ended:           { bg: '#F3F4F6', color: '#374151' },
  pending_moveout: { bg: '#FEF3C7', color: '#92400E' },
}

const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  active:          'Active',
  ended:           'Ended',
  pending_moveout: 'Pending Move-Out',
}

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, { bg: string; color: string }> = {
  succeeded: { bg: '#D1FAE5', color: '#065F46' },
  failed:    { bg: '#FEE2E2', color: '#991B1B' },
  pending:   { bg: '#FEF3C7', color: '#92400E' },
  refunded:  { bg: '#F3F4F6', color: '#374151' },
}

const TYPE_LABELS: Record<UnitType, string> = {
  standard:           'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up:           'Drive-Up',
  vehicle_outdoor:    'Vehicle / Outdoor',
}

// ── Helper components ──────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <Box sx={{ display: 'flex', py: 0.75 }}>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', width: 160, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value ?? '—'}
      </Typography>
    </Box>
  )
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <Card sx={{ border: '1px solid #EDE5D8' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Box sx={{ color: '#B8914A', display: 'flex', alignItems: 'center' }}>{icon}</Box>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, fontFamily: '"Playfair Display", serif' }}
          >
            {title}
          </Typography>
        </Box>
        <Divider sx={{ mb: 2, borderColor: '#EDE5D8' }} />
        {children}
      </CardContent>
    </Card>
  )
}

function PlaceholderCard({ message }: { message: string }) {
  return (
    <Card
      sx={{
        border: '1px solid #EDE5D8',
        bgcolor: '#F9F6F1',
      }}
    >
      <CardContent sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          {message}
        </Typography>
      </CardContent>
    </Card>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <Box>
      {/* Header skeleton */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Skeleton variant="text" width={80} height={36} />
        <Skeleton variant="text" width={200} height={42} />
        <Skeleton variant="rounded" width={90} height={28} sx={{ ml: 1 }} />
        <Skeleton variant="rounded" width={120} height={36} sx={{ ml: 'auto' }} />
      </Box>

      <Grid container spacing={3}>
        {/* Left column */}
        <Grid item xs={12} lg={7}>
          <Card sx={{ border: '1px solid #EDE5D8', mb: 3 }}>
            <CardContent>
              <Skeleton variant="text" width={140} height={28} sx={{ mb: 2 }} />
              <Divider sx={{ mb: 2 }} />
              {Array.from({ length: 6 }).map((_, i) => (
                <Box key={i} sx={{ display: 'flex', py: 0.75 }}>
                  <Skeleton variant="text" width={140} height={20} sx={{ mr: 2 }} />
                  <Skeleton variant="text" width={120} height={20} />
                </Box>
              ))}
            </CardContent>
          </Card>
          <Card sx={{ border: '1px solid #EDE5D8' }}>
            <CardContent>
              <Skeleton variant="text" width={100} height={28} sx={{ mb: 2 }} />
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" width={100} height={28} />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} lg={5}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} sx={{ border: '1px solid #EDE5D8', mb: 3 }}>
              <CardContent>
                <Skeleton variant="text" width={160} height={28} sx={{ mb: 2 }} />
                <Divider sx={{ mb: 2 }} />
                {Array.from({ length: 4 }).map((_, j) => (
                  <Box key={j} sx={{ display: 'flex', py: 0.75 }}>
                    <Skeleton variant="text" width={140} height={20} sx={{ mr: 2 }} />
                    <Skeleton variant="text" width={100} height={20} />
                  </Box>
                ))}
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Grid>
    </Box>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function UnitDetailPage() {
  const params = useParams<{ id: string }>()
  const unitId = params.id

  const [unit, setUnit]         = useState<PopulatedUnit | null>(null)
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const unitRes  = await fetch(`/api/units/${unitId}`)
      const unitJson = await unitRes.json()

      if (!unitRes.ok || !unitJson.success) {
        throw new Error(unitJson.error ?? `Failed to load unit (${unitRes.status})`)
      }

      const fetchedUnit: PopulatedUnit = unitJson.data
      setUnit(fetchedUnit)

      // If there is a populated lease, fetch payments in parallel
      const lease = fetchedUnit.currentLeaseId
      if (lease && typeof lease === 'object' && (lease as PopulatedLease)._id) {
        const leaseId = (lease as PopulatedLease)._id
        const payRes  = await fetch(`/api/payments?leaseId=${leaseId}&limit=10&page=1`)
        const payJson = await payRes.json()

        if (payRes.ok && payJson.success) {
          setPayments(payJson.data?.items ?? [])
        }
        // Payments failure is non-fatal — leave payments as empty array
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load unit')
    } finally {
      setLoading(false)
    }
  }, [unitId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Derived helpers ──────────────────────────────────────────────────────────

  const tenant = unit?.currentTenantId && typeof unit.currentTenantId === 'object'
    ? (unit.currentTenantId as PopulatedTenant)
    : null

  const lease = unit?.currentLeaseId && typeof unit.currentLeaseId === 'object'
    ? (unit.currentLeaseId as PopulatedLease)
    : null

  // ── Error state ────────────────────────────────────────────────────────────

  if (!loading && error) {
    return (
      <Box>
        <Button
          component={Link}
          href="/admin/units"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', mb: 2 }}
        >
          Units
        </Button>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchData}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    )
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return <PageSkeleton />
  }

  if (!unit) return null

  const unitSc = UNIT_STATUS_COLORS[unit.status]
  const hasTenantCard = unit.status === 'occupied' || unit.status === 'reserved'

  // Next payment due: billing day of current month
  function getNextPaymentDue(billingDay: number): string {
    const now = new Date()
    const candidate = new Date(now.getFullYear(), now.getMonth(), billingDay)
    if (candidate <= now) {
      candidate.setMonth(candidate.getMonth() + 1)
    }
    return formatDate(candidate.toISOString())
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ bgcolor: '#FAF7F2', minHeight: '100%' }}>
      {/* ── Header ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 3,
        }}
      >
        <Button
          component={Link}
          href="/admin/units"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', flexShrink: 0 }}
        >
          Units
        </Button>

        <Divider orientation="vertical" flexItem />

        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            fontFamily: '"Playfair Display", serif',
            color: '#1C0F06',
          }}
        >
          Unit {unit.unitNumber}
        </Typography>

        <Chip
          label={UNIT_STATUS_LABELS[unit.status]}
          size="small"
          sx={{
            bgcolor: unitSc.bg,
            color: unitSc.color,
            border: `1px solid ${unitSc.border}`,
            fontWeight: 700,
            fontSize: '0.72rem',
            borderRadius: 1,
          }}
        />

        <Box sx={{ ml: 'auto' }}>
          <Button
            component={Link}
            href={`/admin/units/${unitId}/edit`}
            variant="outlined"
            startIcon={<EditIcon />}
            sx={{
              borderColor: '#EDE5D8',
              color: '#1C0F06',
              '&:hover': { borderColor: '#B8914A', bgcolor: 'rgba(184,145,74,0.06)' },
            }}
          >
            Edit Unit
          </Button>
        </Box>
      </Box>

      {/* ── Two-column grid ── */}
      <Grid container spacing={3}>
        {/* ──────── LEFT COLUMN ──────── */}
        <Grid item xs={12} lg={7}>
          {/* 1. Unit Details card */}
          <SectionCard icon={<HomeIcon fontSize="small" />} title="Unit Details">
            <InfoRow label="Size"           value={unit.size} />
            <InfoRow label="Type"           value={TYPE_LABELS[unit.type]} />
            <InfoRow label="Floor"          value={unit.floor === 'ground' ? 'Ground Floor' : 'Upper Floor'} />
            <InfoRow label="Monthly Rate"   value={formatMoney(unit.price)} />
            <InfoRow label="Square Footage" value={`${unit.sqft} sq ft`} />
            {unit.gateCode && (
              <InfoRow label="Gate Code" value={unit.gateCode} />
            )}
            {unit.notes && (
              <>
                <Divider sx={{ my: 1.5, borderColor: '#EDE5D8' }} />
                <Box sx={{ display: 'flex', py: 0.75 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', width: 160, flexShrink: 0 }}
                  >
                    Notes
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 500, color: '#92400E', fontStyle: 'italic' }}
                  >
                    {unit.notes}
                  </Typography>
                </Box>
              </>
            )}
          </SectionCard>

          {/* 2. Features */}
          {unit.features.length > 0 && (
            <Card sx={{ border: '1px solid #EDE5D8', mt: 3 }}>
              <CardContent>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 700,
                    fontFamily: '"Playfair Display", serif',
                    mb: 1.5,
                  }}
                >
                  Features
                </Typography>
                <Divider sx={{ mb: 2, borderColor: '#EDE5D8' }} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {unit.features.map((feature) => (
                    <Chip
                      key={feature}
                      label={feature}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderRadius: 1,
                        borderColor: '#EDE5D8',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                      }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* ──────── RIGHT COLUMN ──────── */}
        <Grid item xs={12} lg={5}>
          {/* 3. Current Tenant card */}
          {hasTenantCard && tenant ? (
            <SectionCard icon={<PersonIcon fontSize="small" />} title="Current Tenant">
              {/* Tenant name + status */}
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                  {tenant.firstName} {tenant.lastName}
                </Typography>
                {(() => {
                  const sc = TENANT_STATUS_COLORS[tenant.status]
                  return (
                    <Chip
                      label={TENANT_STATUS_LABELS[tenant.status]}
                      size="small"
                      sx={{
                        bgcolor: sc.bg,
                        color: sc.color,
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        borderRadius: 1,
                      }}
                    />
                  )
                })()}
              </Box>
              <Divider sx={{ mb: 1.5, borderColor: '#EDE5D8' }} />
              <InfoRow label="Email"           value={tenant.email} />
              <InfoRow label="Phone"           value={tenant.phone} />
              {tenant.alternatePhone && (
                <InfoRow label="Alt Phone" value={tenant.alternatePhone} />
              )}
              {tenant.driversLicense && (
                <InfoRow label="Drivers License" value={tenant.driversLicense} />
              )}
              {(tenant.city || tenant.state || tenant.zip) && (
                <InfoRow
                  label="Address"
                  value={[tenant.city, tenant.state, tenant.zip].filter(Boolean).join(', ')}
                />
              )}
              <Box sx={{ mt: 2 }}>
                <Button
                  component={Link}
                  href={`/admin/tenants/${tenant._id}`}
                  variant="outlined"
                  size="small"
                  startIcon={<PersonIcon fontSize="small" />}
                  sx={{
                    borderColor: '#EDE5D8',
                    color: '#1C0F06',
                    '&:hover': { borderColor: '#B8914A', bgcolor: 'rgba(184,145,74,0.06)' },
                  }}
                >
                  View Tenant
                </Button>
              </Box>
            </SectionCard>
          ) : hasTenantCard ? (
            <PlaceholderCard message="No tenant assigned to this unit." />
          ) : (
            <PlaceholderCard message="No tenant assigned — unit is not occupied." />
          )}

          {/* 4. Active Lease card */}
          <Box sx={{ mt: 3 }}>
            {lease ? (
              <SectionCard icon={<HomeIcon fontSize="small" />} title="Active Lease">
                <InfoRow label="Lease Start"    value={formatDate(lease.startDate)} />
                {lease.endDate && (
                  <InfoRow label="Lease End" value={formatDate(lease.endDate)} />
                )}
                <InfoRow label="Monthly Rate"   value={formatMoney(lease.monthlyRate)} />
                <InfoRow label="Security Deposit" value={formatMoney(lease.deposit)} />
                <InfoRow
                  label="Lease Status"
                  value={LEASE_STATUS_LABELS[lease.status] ?? lease.status}
                />
                {lease.moveOutDate && (
                  <InfoRow label="Move-Out Date" value={formatDate(lease.moveOutDate)} />
                )}

                {/* Next payment due — highlighted row */}
                <Divider sx={{ my: 1.5, borderColor: '#EDE5D8' }} />
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    py: 1,
                    px: 1.5,
                    borderRadius: 1,
                    bgcolor: 'rgba(184,145,74,0.08)',
                    border: '1px solid rgba(184,145,74,0.25)',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: '#92400E', fontWeight: 600, width: 160, flexShrink: 0 }}
                  >
                    Next Payment Due
                  </Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#92400E' }}>
                      {formatMoney(lease.monthlyRate)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#92400E', opacity: 0.8 }}>
                      {getNextPaymentDue(lease.billingDay)}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <Button
                    component={Link}
                    href={`/admin/leases/${lease._id}`}
                    variant="outlined"
                    size="small"
                    startIcon={<ReceiptIcon fontSize="small" />}
                    sx={{
                      borderColor: '#EDE5D8',
                      color: '#1C0F06',
                      '&:hover': { borderColor: '#B8914A', bgcolor: 'rgba(184,145,74,0.06)' },
                    }}
                  >
                    View Lease
                  </Button>
                </Box>
              </SectionCard>
            ) : (
              <PlaceholderCard message="No active lease on this unit." />
            )}
          </Box>

          {/* 5. Payment History card */}
          <Box sx={{ mt: 3 }}>
            <SectionCard icon={<ReceiptIcon fontSize="small" />} title="Payment History">
              {payments.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 1 }}>
                  No payment history
                </Typography>
              ) : (
                <>
                  {payments.map((payment) => {
                    const sc = PAYMENT_STATUS_COLORS[payment.status]
                    return (
                      <Box
                        key={payment._id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          py: 0.875,
                          borderBottom: '1px solid #EDE5D8',
                          '&:last-of-type': { borderBottom: 'none' },
                          gap: 1,
                        }}
                      >
                        {/* Date */}
                        <Typography
                          variant="body2"
                          sx={{ color: 'text.secondary', flexShrink: 0, width: 100 }}
                        >
                          {formatDate(payment.createdAt)}
                        </Typography>

                        {/* Amount */}
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, flexGrow: 1 }}
                        >
                          {formatMoney(payment.amount)}
                        </Typography>

                        {/* Status chip */}
                        <Chip
                          label={payment.status}
                          size="small"
                          sx={{
                            bgcolor: sc.bg,
                            color: sc.color,
                            fontWeight: 700,
                            fontSize: '0.68rem',
                            textTransform: 'capitalize',
                            borderRadius: 1,
                            flexShrink: 0,
                          }}
                        />
                      </Box>
                    )
                  })}

                  {lease && (
                    <Box sx={{ mt: 2 }}>
                      <Button
                        component={Link}
                        href={`/admin/payments?leaseId=${lease._id}`}
                        size="small"
                        sx={{
                          color: '#B8914A',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          p: 0,
                          '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                        }}
                      >
                        View all payments →
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </SectionCard>
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}
