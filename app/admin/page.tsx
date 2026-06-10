'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Autocomplete,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import LockIcon from '@mui/icons-material/Lock'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import { formatMoney, formatDate } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  occupancyPct: number
  revenueMtd: number
  availableUnits: number
  delinquentCount: number
  lockedOutCount: number
  waitingListCount: number
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
  tenantId: string | null
  name: string
  unit: string
  moveOutDate: string
  balance: number
}

interface SearchOption {
  group: 'Clients' | 'Units'
  id: string
  label: string
  detail: string
  href: string
}

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
  /** Destination the whole card links to (reports, customers, or units). */
  href: string
}

function KpiCard({ label, value, icon, iconBg, subLabel, href }: KpiCardProps) {
  return (
    <Card>
      <CardActionArea component={Link} href={href} sx={{ height: '100%' }}>
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
      </CardActionArea>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter()
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [delinquent, setDelinquent] = useState<DelinquentRow[]>([])
  const [moveOuts, setMoveOuts] = useState<MoveOutRow[]>([])
  const [loading, setLoading] = useState(true)

  // ── Search bar (clients + units) ──────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const [searchOptions, setSearchOptions] = useState<SearchOption[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    const q = searchInput.trim()
    if (!q) { setSearchOptions([]); setSearchLoading(false); return }
    let cancelled = false
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        if (!cancelled && json.success) {
          const opts: SearchOption[] = [
            ...json.data.clients.map((c: { id: string; name: string; detail: string }) => ({
              group: 'Clients' as const, id: c.id, label: c.name, detail: c.detail, href: `/admin/tenants/${c.id}`,
            })),
            ...json.data.units.map((u: { id: string; unitNumber: string; detail: string }) => ({
              group: 'Units' as const, id: u.id, label: `Unit ${u.unitNumber}`, detail: u.detail, href: `/admin/units/${u.id}`,
            })),
          ]
          setSearchOptions(opts)
        }
      } catch {
        // ignore — stale or failed lookup
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [searchInput])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/dashboard')
        const json = await res.json()
        if (json.success) {
          setKpi(json.data.kpis)
          setDelinquent(json.data.delinquent)
          setMoveOuts(json.data.moveOuts)
        }
      } catch {
        // silently fail — KPIs will show 0
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
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
        Dashboard
      </Typography>

      {/* Search — clients or units */}
      <Autocomplete<SearchOption>
        options={searchOptions}
        loading={searchLoading}
        filterOptions={(x) => x}
        groupBy={(o) => o.group}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(o, v) => o.id === v.id && o.group === v.group}
        inputValue={searchInput}
        onInputChange={(_, val, reason) => { if (reason !== 'reset') setSearchInput(val) }}
        onChange={(_, val) => {
          if (val) {
            router.push(val.href)
            setSearchInput('')
            setSearchOptions([])
          }
        }}
        blurOnSelect
        clearOnEscape
        noOptionsText={searchInput.trim() ? 'No matches' : 'Type a name, email, phone, or unit #'}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={`${option.group}-${option.id}`}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{option.label}</Typography>
              {option.detail && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{option.detail}</Typography>
              )}
            </Box>
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search clients or units…"
            size="small"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <>
                  {searchLoading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        sx={{ maxWidth: 480, mb: 4 }}
      />

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Occupancy Rate"
            value={`${k.occupancyPct}%`}
            icon={<HomeWorkIcon sx={{ color: '#B8914A' }} />}
            iconBg="#FEF3C7"
            subLabel="of total units"
            href="/admin/units"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Revenue MTD"
            value={formatMoney(k.revenueMtd)}
            icon={<AttachMoneyIcon sx={{ color: '#16A34A' }} />}
            iconBg="#D1FAE5"
            subLabel="month to date"
            href="/admin/payments"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Available Units"
            value={k.availableUnits}
            icon={<MeetingRoomIcon sx={{ color: '#1E3A5F' }} />}
            iconBg="#DBEAFE"
            subLabel="ready to rent"
            href="/admin/units"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Delinquent"
            value={k.delinquentCount}
            icon={<WarningAmberIcon sx={{ color: '#92400E' }} />}
            iconBg="#FEF3C7"
            subLabel="past due tenants"
            href="/admin/delinquency"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Locked Out"
            value={k.lockedOutCount}
            icon={<LockIcon sx={{ color: '#991B1B' }} />}
            iconBg="#FEE2E2"
            subLabel="access revoked"
            href="/admin/reports/lock-out"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <KpiCard
            label="Waiting List"
            value={k.waitingListCount}
            icon={<PeopleOutlineIcon sx={{ color: '#3B0764' }} />}
            iconBg="#EDE9FE"
            subLabel="prospects queued"
            href="/admin/waiting-list"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Delinquency Breakdown */}
        <Grid item xs={12} lg={7}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #E5E7EB' }}>
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
                        <TableRow
                          key={row.id}
                          hover
                          role="link"
                          tabIndex={0}
                          onClick={() => router.push(`/admin/tenants/${row.id}`)}
                          onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/admin/tenants/${row.id}`) }}
                          sx={{ cursor: 'pointer' }}
                        >
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
                      ))
                    )}
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
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #E5E7EB' }}>
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
                        <TableRow
                          key={row.id}
                          hover={!!row.tenantId}
                          role={row.tenantId ? 'link' : undefined}
                          tabIndex={row.tenantId ? 0 : undefined}
                          onClick={() => row.tenantId && router.push(`/admin/tenants/${row.tenantId}`)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && row.tenantId) router.push(`/admin/tenants/${row.tenantId}`) }}
                          sx={{ cursor: row.tenantId ? 'pointer' : 'default' }}
                        >
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
      </Grid>
    </Box>
  )
}
