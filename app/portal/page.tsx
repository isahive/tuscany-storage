'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Divider,
  CircularProgress,
} from '@mui/material'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import PaymentIcon from '@mui/icons-material/Payment'
import LockIcon from '@mui/icons-material/Lock'
import PhoneIcon from '@mui/icons-material/Phone'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import BlockIcon from '@mui/icons-material/Block'
import KeyIcon from '@mui/icons-material/Key'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { AccessLog, EventType } from '@/types'

const formatMoney = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const formatDate = (date: string | Date): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

const formatDateTime = (date: string | Date): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(date))

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventIcon({ type }: { type: EventType }) {
  switch (type) {
    case 'entry':        return <ArrowDownwardIcon sx={{ fontSize: 16, color: '#16A34A' }} />
    case 'exit':         return <ArrowUpwardIcon   sx={{ fontSize: 16, color: '#6B7280' }} />
    case 'denied':       return <BlockIcon         sx={{ fontSize: 16, color: '#DC2626' }} />
    case 'code_changed': return <KeyIcon           sx={{ fontSize: 16, color: '#D97706' }} />
  }
}

function eventLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    entry: 'Entry', exit: 'Exit', denied: 'Denied', code_changed: 'Code Changed',
  }
  return labels[type]
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardUnit {
  unitNumber: string
  size: string
  type: string
  floor: string
  features: string[]
  monthlyRate: number
}

interface DashboardLease {
  startDate: string
  billingDay: number
  autopayEnabled: boolean
  nextPaymentAmount: number
  nextPaymentDate: string
  daysUntilDue: number
}

interface DashboardData {
  tenant: { firstName: string; balance: number }
  unit: DashboardUnit | null
  lease: DashboardLease | null
  accessLogs: AccessLog[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalDashboard() {
  const router = useRouter()
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) return
    fetch('/api/portal/dashboard')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data)
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false))
  }, [session?.user?.id])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!data || (!data.lease && !data.unit)) {
    const firstName = data?.tenant?.firstName ?? session?.user?.name?.split(' ')[0] ?? 'there'
    return (
      <Box>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}>
          Welcome back, {firstName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Here&apos;s an overview of your storage account.
        </Typography>
        <Card>
          <CardContent sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>No active lease</Typography>
            <Typography variant="body2" color="text.secondary">
              You don&apos;t have an active storage lease at this time. Contact us if you believe this is an error.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    )
  }

  const { tenant, unit, lease, accessLogs } = data
  const firstName = tenant.firstName ?? session?.user?.name?.split(' ')[0] ?? 'there'
  const progress = lease ? Math.max(0, Math.min(100, ((30 - lease.daysUntilDue) / 30) * 100)) : 0

  return (
    <Box>
      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}>
        Welcome back, {firstName}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Here&apos;s an overview of your storage account.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* Unit Info */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <WarehouseIcon sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  Your Unit
                </Typography>
              </Box>
              {unit ? (
                <>
                  <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}>
                    Unit {unit.unitNumber}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {unit.size} &bull; {unit.type} &bull; {unit.floor} floor
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {unit.features.map((f) => (
                      <Chip key={f} label={f} size="small" variant="outlined" />
                    ))}
                  </Box>
                  {lease && (
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon sx={{ fontSize: 16, color: '#16A34A' }} />
                      <Typography variant="caption" sx={{ color: '#065F46', fontWeight: 500 }}>
                        Active since {formatDate(lease.startDate)}
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Unit information unavailable.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Next Payment */}
        {lease && (
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <PaymentIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Next Payment
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.25 }}>
                  {formatMoney(lease.nextPaymentAmount)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Due {formatDate(lease.nextPaymentDate)} &bull; {lease.daysUntilDue} days away
                </Typography>

                <Box sx={{ mb: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: '#EDE5D8',
                      '& .MuiLinearProgress-bar': { bgcolor: 'primary.main', borderRadius: 3 },
                    }}
                  />
                </Box>

                <Divider sx={{ my: 2 }} />

                {lease.autopayEnabled ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: '#16A34A' }} />
                    <Typography variant="caption" sx={{ color: '#065F46', fontWeight: 500 }}>
                      Autopay enabled — Visa ••••4242
                    </Typography>
                  </Box>
                ) : (
                  <Button variant="contained" size="small" onClick={() => router.push('/portal/payments')}>
                    Pay now
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Recent Access Log */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Recent Gate Activity
          </Typography>
          {accessLogs.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Event</TableCell>
                    <TableCell>Gate</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Date &amp; Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accessLogs.map((log) => (
                    <TableRow key={log._id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <EventIcon type={log.eventType} />
                          <Typography variant="body2">{eventLabel(log.eventType)}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{log.gateId}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{log.source}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDateTime(log.createdAt)}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No gate activity recorded yet.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<PaymentIcon />}
              onClick={() => router.push('/portal/payments')}
            >
              Pay now
            </Button>
            <Button
              variant="outlined"
              startIcon={<LockIcon />}
              onClick={() => router.push('/portal/gate-code')}
            >
              Gate code
            </Button>
            <Button
              variant="outlined"
              startIcon={<PhoneIcon />}
              href="tel:+18654262100"
              component="a"
            >
              Contact us
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
