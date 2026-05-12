'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import LockIcon from '@mui/icons-material/Lock'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import LanguageIcon from '@mui/icons-material/Language'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import { formatMoney, formatDate } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  occupancyPct: number
  revenueMtd: number
  availableUnits: number
  delinquentCount: number
  lockedOutCount: number
  waitingListCount: number
  awaitingPaymentCount: number
  awaitingPaymentAmount: number
  recurringBillingPct: number
  websiteRentalsPct: number
  lateUnitsCount: number
}

interface DelinquentRow {
  id: string
  name: string
  unit: string
  daysPastDue: number
  balance: number
  stage: string
}

interface MoveOutRow {
  id: string
  name: string
  unit: string
  moveOutDate: string
  balance: number
}

interface MonthValue {
  label: string
  value: number
}

interface UndeliveredNotification {
  id: string
  tenant: string
  type: string
  channel: string
  status: string
  reason: string | null
  date: string
}

interface Task {
  id: string
  label: string
  type: string
  href: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Late':        { bg: '#FEF3C7', color: '#92400E' },
  'Locked Out':  { bg: '#FEE2E2', color: '#991B1B' },
  'Pre-Lien':    { bg: '#FEE2E2', color: '#7F1D1D' },
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

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

// ── Simple Bar Chart ──────────────────────────────────────────────────────────

function BarChart({ data, color = '#B8914A', valueFormatter = (v: number) => String(v) }: {
  data: MonthValue[]
  color?: string
  valueFormatter?: (v: number) => string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: 120, pt: 1 }}>
      {data.map((d) => {
        const h = Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)
        return (
          <Box
            key={d.label}
            sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%' }}
            title={valueFormatter(d.value)}
          >
            <Box sx={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <Box
                sx={{
                  width: '100%',
                  bgcolor: color,
                  borderRadius: '3px 3px 0 0',
                  height: `${h}%`,
                  minHeight: d.value > 0 ? 4 : 0,
                  transition: 'height 0.3s ease',
                  opacity: 0.85,
                  '&:hover': { opacity: 1 },
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
              {d.label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [delinquent, setDelinquent] = useState<DelinquentRow[]>([])
  const [moveOuts, setMoveOuts] = useState<MoveOutRow[]>([])
  const [revenueByMonth, setRevenueByMonth] = useState<MonthValue[]>([])
  const [occupancyByMonth, setOccupancyByMonth] = useState<MonthValue[]>([])
  const [undelivered, setUndelivered] = useState<UndeliveredNotification[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/admin/dashboard')
        const json = await res.json()
        if (json.success) {
          setKpi(json.data.kpis)
          setDelinquent(json.data.delinquent)
          setMoveOuts(json.data.moveOuts)
          setRevenueByMonth(json.data.revenueByMonth ?? [])
          setOccupancyByMonth(json.data.occupancyByMonth ?? [])
          setUndelivered(json.data.undeliveredNotifications ?? [])
          setTasks(json.data.tasks ?? [])
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}>
        <CircularProgress />
      </Box>
    )
  }

  const k = kpi ?? {
    occupancyPct: 0, revenueMtd: 0, availableUnits: 0,
    delinquentCount: 0, lockedOutCount: 0, waitingListCount: 0,
    awaitingPaymentCount: 0, awaitingPaymentAmount: 0,
    recurringBillingPct: 0, websiteRentalsPct: 0, lateUnitsCount: 0,
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: 'text.primary' }}>
        Dashboard
      </Typography>

      {/* ── KPI Row 1 ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Occupancy Rate"
            value={`${k.occupancyPct}%`}
            icon={<HomeWorkIcon sx={{ color: '#B8914A' }} />}
            iconBg="#FEF3C7"
            subLabel="of total units"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Revenue MTD"
            value={formatMoney(k.revenueMtd)}
            icon={<AttachMoneyIcon sx={{ color: '#16A34A' }} />}
            iconBg="#D1FAE5"
            subLabel="month to date"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Available Units"
            value={k.availableUnits}
            icon={<MeetingRoomIcon sx={{ color: '#1E3A5F' }} />}
            iconBg="#DBEAFE"
            subLabel="ready to rent"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Delinquent"
            value={k.delinquentCount}
            icon={<WarningAmberIcon sx={{ color: '#92400E' }} />}
            iconBg="#FEF3C7"
            subLabel="past due tenants"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Locked Out"
            value={k.lockedOutCount}
            icon={<LockIcon sx={{ color: '#991B1B' }} />}
            iconBg="#FEE2E2"
            subLabel="access revoked"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Waiting List"
            value={k.waitingListCount}
            icon={<PeopleOutlineIcon sx={{ color: '#3B0764' }} />}
            iconBg="#EDE9FE"
            subLabel="prospects queued"
          />
        </Grid>
      </Grid>

      {/* ── KPI Row 2 — new blocks ── */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="Awaiting Payment"
            value={k.awaitingPaymentCount}
            icon={<HourglassEmptyIcon sx={{ color: '#B8914A' }} />}
            iconBg="#FEF3C7"
            subLabel={k.awaitingPaymentAmount > 0 ? `${formatMoney(k.awaitingPaymentAmount)} owed` : 'no balance due'}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="% Website Rentals"
            value={`${k.websiteRentalsPct}%`}
            icon={<LanguageIcon sx={{ color: '#1D4ED8' }} />}
            iconBg="#DBEAFE"
            subLabel="portal-signed leases"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="% Recurring Billing"
            value={`${k.recurringBillingPct}%`}
            icon={<AutorenewIcon sx={{ color: '#16A34A' }} />}
            iconBg="#D1FAE5"
            subLabel="autopay enabled"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="Late Units"
            value={k.lateUnitsCount}
            icon={<ErrorOutlineIcon sx={{ color: '#DC2626' }} />}
            iconBg="#FEE2E2"
            subLabel="delinquent status"
          />
        </Grid>
      </Grid>

      {/* ── Charts Row ── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Revenue Chart */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>Revenue</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>Last 6 months</Typography>
              {revenueByMonth.length > 0 ? (
                <BarChart
                  data={revenueByMonth}
                  color="#B8914A"
                  valueFormatter={(v) => formatMoney(v)}
                />
              ) : (
                <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No payment data yet</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Occupancy Chart */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>Occupancy</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>Last 6 months</Typography>
              {occupancyByMonth.length > 0 ? (
                <BarChart
                  data={occupancyByMonth}
                  color="#1E3A5F"
                  valueFormatter={(v) => `${v}%`}
                />
              ) : (
                <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No data</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Awaiting Payment mini-chart */}
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>Awaiting Payment</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>Balance summary</Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 100,
                  gap: 1,
                }}
              >
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#B8914A', lineHeight: 1 }}>
                  {k.awaitingPaymentCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">tenant{k.awaitingPaymentCount !== 1 ? 's' : ''}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: k.awaitingPaymentAmount > 0 ? '#DC2626' : 'text.secondary' }}>
                  {formatMoney(k.awaitingPaymentAmount)} owed
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* ── Delinquency Breakdown ── */}
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
                    {delinquent.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                          No delinquent tenants
                        </TableCell>
                      </TableRow>
                    ) : (
                      delinquent.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ fontWeight: 500 }}>
                            <Link href={`/admin/tenants/${row.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                              {row.name}
                            </Link>
                          </TableCell>
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Upcoming Move-Outs ── */}
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
                    {moveOuts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                          No upcoming move-outs
                        </TableCell>
                      </TableRow>
                    ) : (
                      moveOuts.map((row) => (
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Tasks ── */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #EDE5D8', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckBoxOutlineBlankIcon sx={{ color: '#B8914A', fontSize: 20 }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Tasks</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Items requiring attention
                  </Typography>
                </Box>
                {tasks.length > 0 && (
                  <Chip
                    label={tasks.length}
                    size="small"
                    sx={{ ml: 'auto', bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
              {tasks.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No pending tasks</Typography>
                </Box>
              ) : (
                <Box sx={{ divide: 'y' }}>
                  {tasks.map((task) => (
                    <Box
                      key={task.id}
                      component={Link}
                      href={task.href}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        px: 3,
                        py: 1.5,
                        borderBottom: '1px solid #F3F4F6',
                        textDecoration: 'none',
                        color: 'inherit',
                        '&:hover': { bgcolor: '#FAF7F2' },
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: task.type === 'unsigned_lease' ? '#B8914A' : '#1D4ED8',
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" sx={{ flex: 1, fontSize: '0.82rem' }}>
                        {task.label}
                      </Typography>
                      <Chip
                        label={task.type === 'unsigned_lease' ? 'Unsigned' : 'Move-Out'}
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          height: 18,
                          bgcolor: task.type === 'unsigned_lease' ? '#FEF3C7' : '#DBEAFE',
                          color: task.type === 'unsigned_lease' ? '#92400E' : '#1E3A5F',
                          fontWeight: 600,
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Undelivered Notifications ── */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #EDE5D8', display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationsOffIcon sx={{ color: '#DC2626', fontSize: 20 }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Undelivered Notifications</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Failed or undelivered messages
                  </Typography>
                </Box>
                {undelivered.length > 0 && (
                  <Chip
                    label={undelivered.length}
                    size="small"
                    sx={{ ml: 'auto', bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 700, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
              {undelivered.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No undelivered notifications</Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Tenant</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Channel</TableCell>
                        <TableCell align="center">Status</TableCell>
                        <TableCell align="right">Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {undelivered.map((n) => (
                        <TableRow key={n.id} hover>
                          <TableCell sx={{ fontWeight: 500, fontSize: '0.82rem' }}>{n.tenant}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                            {n.type.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell sx={{ textTransform: 'capitalize', fontSize: '0.78rem' }}>{n.channel}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={n.status}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                bgcolor: n.status === 'failed' ? '#FEE2E2' : '#FEF3C7',
                                color: n.status === 'failed' ? '#991B1B' : '#92400E',
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                            {formatDate(n.date)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
