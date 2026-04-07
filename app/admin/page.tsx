'use client'

import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
} from '@mui/material'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import LockIcon from '@mui/icons-material/Lock'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import { formatMoney, formatDate } from '@/lib/utils'

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_KPIS = {
  occupancyPct: 87,
  revenueMtd: 2341500,       // cents
  availableUnits: 8,
  delinquentCount: 4,
  lockedOutCount: 2,
  waitingListCount: 11,
}

interface DelinquentRow {
  id: string
  name: string
  unit: string
  daysPastDue: number
  balance: number            // cents
  stage: string
}

const MOCK_DELINQUENT: DelinquentRow[] = [
  { id: '1', name: 'Robert Chen',    unit: '12A', daysPastDue: 22, balance: 18500, stage: 'Locked Out' },
  { id: '2', name: 'Maria Santos',   unit: '07C', daysPastDue: 14, balance: 24000, stage: 'Locked Out' },
  { id: '3', name: 'David Kim',      unit: '31B', daysPastDue:  8, balance: 15500, stage: 'Late' },
  { id: '4', name: 'Angela Torres',  unit: '19D', daysPastDue:  6, balance: 10000, stage: 'Late' },
]

interface MoveOutRow {
  id: string
  name: string
  unit: string
  moveOutDate: string
  balance: number  // cents
}

const MOCK_MOVEOUTS: MoveOutRow[] = [
  { id: '1', name: 'James Wilson',    unit: '04A', moveOutDate: '2026-04-15', balance: 0 },
  { id: '2', name: 'Lisa Nakamura',   unit: '22B', moveOutDate: '2026-04-20', balance: 10000 },
  { id: '3', name: 'Tom Bradley',     unit: '09C', moveOutDate: '2026-04-30', balance: 0 },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Late':        { bg: '#FEF3C7', color: '#92400E' },
  'Locked Out':  { bg: '#FEE2E2', color: '#991B1B' },
  'Pre-Lien':    { bg: '#FEE2E2', color: '#7F1D1D' },
}

interface KpiCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
  subLabel?: string
}

function KpiCard({ label, value, icon, iconBg, subLabel }: KpiCardProps) {
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const kpi = MOCK_KPIS

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: 'text.primary' }}>
        Dashboard
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Occupancy Rate"
            value={`${kpi.occupancyPct}%`}
            icon={<HomeWorkIcon sx={{ color: '#B8914A' }} />}
            iconBg="#FEF3C7"
            subLabel="of total units"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Revenue MTD"
            value={formatMoney(kpi.revenueMtd)}
            icon={<AttachMoneyIcon sx={{ color: '#16A34A' }} />}
            iconBg="#D1FAE5"
            subLabel="month to date"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Available Units"
            value={kpi.availableUnits}
            icon={<MeetingRoomIcon sx={{ color: '#1E3A5F' }} />}
            iconBg="#DBEAFE"
            subLabel="ready to rent"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Delinquent"
            value={kpi.delinquentCount}
            icon={<WarningAmberIcon sx={{ color: '#92400E' }} />}
            iconBg="#FEF3C7"
            subLabel="past due tenants"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Locked Out"
            value={kpi.lockedOutCount}
            icon={<LockIcon sx={{ color: '#991B1B' }} />}
            iconBg="#FEE2E2"
            subLabel="access revoked"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Waiting List"
            value={kpi.waitingListCount}
            icon={<PeopleOutlineIcon sx={{ color: '#3B0764' }} />}
            iconBg="#EDE9FE"
            subLabel="prospects queued"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Delinquency Breakdown */}
        <Grid item xs={12} lg={7}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #EDE5D8' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Delinquency Breakdown
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Tenants currently past due
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Tenant</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell align="right">Days Past Due</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      <TableCell align="center">Stage</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {MOCK_DELINQUENT.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{row.unit}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: '#DC2626' }}>
                          {row.daysPastDue}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500 }}>
                          {formatMoney(row.balance)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={row.stage}
                            size="small"
                            sx={{
                              bgcolor: STATUS_COLORS[row.stage]?.bg ?? '#F3F4F6',
                              color: STATUS_COLORS[row.stage]?.color ?? '#374151',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Upcoming Move-Outs */}
        <Grid item xs={12} lg={5}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #EDE5D8' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Upcoming Move-Outs
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Scheduled in the next 30 days
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Tenant</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell align="right">Move-Out Date</TableCell>
                      <TableCell align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {MOCK_MOVEOUTS.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{row.unit}</TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary' }}>
                          {formatDate(row.moveOutDate)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontWeight: 500, color: row.balance > 0 ? '#DC2626' : '#16A34A' }}
                        >
                          {formatMoney(row.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
