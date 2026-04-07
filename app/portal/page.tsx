'use client'

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
import type { AccessLog, EventType } from '@/types'

const formatMoney = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const formatDate = (date: string | Date): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

const formatDateTime = (date: string | Date): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(date))

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_UNIT = {
  unitNumber: '14B',
  size: '10x10',
  type: 'Drive-Up Access',
  floor: 'Ground',
  features: ['Drive-up access', 'LED lighting', 'Ground floor'],
  monthlyRate: 16500,
}

const MOCK_LEASE = {
  startDate: '2024-11-01',
  billingDay: 15,
  autopayEnabled: true,
  nextPaymentAmount: 16500,
  nextPaymentDate: '2026-04-15',
  daysUntilDue: 8,
}

const MOCK_ACCESS_LOGS: AccessLog[] = [
  { _id: '1', tenantId: 't1', eventType: 'entry', gateId: 'entrance', source: 'keypad', createdAt: '2026-04-06T14:23:00Z' },
  { _id: '2', tenantId: 't1', eventType: 'exit',  gateId: 'exit',     source: 'keypad', createdAt: '2026-04-06T15:10:00Z' },
  { _id: '3', tenantId: 't1', eventType: 'entry', gateId: 'entrance', source: 'keypad', createdAt: '2026-04-04T09:05:00Z' },
  { _id: '4', tenantId: 't1', eventType: 'exit',  gateId: 'exit',     source: 'keypad', createdAt: '2026-04-04T09:47:00Z' },
  { _id: '5', tenantId: 't1', eventType: 'entry', gateId: 'entrance', source: 'app',    createdAt: '2026-04-01T11:30:00Z' },
]

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalDashboard() {
  const router = useRouter()
  const progress = Math.max(0, Math.min(100, ((30 - MOCK_LEASE.daysUntilDue) / 30) * 100))

  return (
    <Box>
      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}>
        Welcome back, John
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
              <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}>
                Unit {MOCK_UNIT.unitNumber}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {MOCK_UNIT.size} &bull; {MOCK_UNIT.type} &bull; {MOCK_UNIT.floor} floor
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {MOCK_UNIT.features.map((f) => (
                  <Chip key={f} label={f} size="small" variant="outlined" />
                ))}
              </Box>
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon sx={{ fontSize: 16, color: '#16A34A' }} />
                <Typography variant="caption" sx={{ color: '#065F46', fontWeight: 500 }}>
                  Active since {formatDate(MOCK_LEASE.startDate)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Next Payment */}
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
                {formatMoney(MOCK_LEASE.nextPaymentAmount)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Due {formatDate(MOCK_LEASE.nextPaymentDate)} &bull; {MOCK_LEASE.daysUntilDue} days away
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

              {MOCK_LEASE.autopayEnabled ? (
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
      </Grid>

      {/* Recent Access Log */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Recent Gate Activity
          </Typography>
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
                {MOCK_ACCESS_LOGS.map((log) => (
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
              href="tel:+18435551234"
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
