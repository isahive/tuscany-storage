'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import MapIcon from '@mui/icons-material/Map'
import GridViewIcon from '@mui/icons-material/GridView'
import RefreshIcon from '@mui/icons-material/Refresh'
import { formatMoney } from '@/lib/utils'
import type { UnitStatus, UnitType } from '@/types'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<UnitStatus, { bg: string; color: string; border: string }> = {
  available:   { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
  occupied:    { bg: '#DBEAFE', color: '#1E3A5F', border: '#93C5FD' },
  maintenance: { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
  reserved:    { bg: '#EDE9FE', color: '#3B0764', border: '#C4B5FD' },
}

const STATUS_LABELS: Record<UnitStatus, string> = {
  available:   'Available',
  occupied:    'Occupied',
  maintenance: 'Maintenance',
  reserved:    'Reserved',
}

const TYPE_LABELS: Record<UnitType, string> = {
  standard:           'Standard',
  climate_controlled: 'Climate',
  drive_up:           'Drive-Up',
  vehicle_outdoor:    'Vehicle',
}

// ── API unit shape ─────────────────────────────────────────────────────────────

interface TenantRef {
  _id: string
  firstName: string
  lastName: string
}

interface UnitData {
  _id: string
  unitNumber: string
  size: string
  type: UnitType
  floor: 'ground' | 'upper'
  price: number
  status: UnitStatus
  features: string[]
  notes?: string
  currentTenantId?: TenantRef | string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tenantName(unit: UnitData): string | null {
  if (!unit.currentTenantId || typeof unit.currentTenantId !== 'object') return null
  return `${unit.currentTenantId.firstName} ${unit.currentTenantId.lastName}`
}

// ── Unit card ─────────────────────────────────────────────────────────────────

function UnitCard({ unit, onClick }: { unit: UnitData; onClick: () => void }) {
  const sc = STATUS_COLORS[unit.status]
  const name = tenantName(unit)

  return (
    <Box
      onClick={onClick}
      sx={{
        border: `2px solid ${sc.border}`,
        borderRadius: 1,
        bgcolor: sc.bg,
        p: 1.25,
        cursor: 'pointer',
        transition: 'transform 0.1s, box-shadow 0.1s',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' },
        minHeight: 80,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: sc.color, fontSize: '0.95rem' }}>
          {unit.unitNumber}
        </Typography>
        <Typography variant="caption" sx={{ color: sc.color, opacity: 0.8 }}>
          {TYPE_LABELS[unit.type]}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" sx={{ color: sc.color, display: 'block' }}>
          {unit.size}
        </Typography>
        {name ? (
          <Typography
            variant="caption"
            sx={{ color: sc.color, opacity: 0.85, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {name}
          </Typography>
        ) : (
          <Typography variant="caption" sx={{ color: sc.color, opacity: 0.7 }}>
            {formatMoney(unit.price)}/mo
          </Typography>
        )}
      </Box>
    </Box>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function UnitsSkeleton() {
  return (
    <Grid container spacing={1.5}>
      {Array.from({ length: 24 }).map((_, i) => (
        <Grid item key={i} xs={6} sm={4} md={3} lg={2}>
          <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
        </Grid>
      ))}
    </Grid>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type StatusFilter = UnitStatus | 'all'
type TypeFilter = UnitType | 'all'

export default function UnitsPage() {
  const router = useRouter()
  const [units, setUnits] = useState<UnitData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sizeFilter, setSizeFilter] = useState('all')

  const fetchUnits = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/units?limit=200')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load units')
      // API returns { data: { items, total } } or { data: [] }
      const items = Array.isArray(json.data) ? json.data : (json.data.items ?? [])
      setUnits(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load units')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUnits() }, [fetchUnits])

  const allSizes = useMemo(() => [...new Set(units.map((u) => u.size))].sort(), [units])

  const filtered = useMemo(() => {
    return units.filter((u) => {
      const matchStatus = statusFilter === 'all' || u.status === statusFilter
      const matchType   = typeFilter === 'all'   || u.type === typeFilter
      const matchSize   = sizeFilter === 'all'   || u.size === sizeFilter
      return matchStatus && matchType && matchSize
    })
  }, [units, statusFilter, typeFilter, sizeFilter])

  const counts = useMemo(
    () => units.reduce<Record<UnitStatus, number>>(
      (acc, u) => { acc[u.status]++; return acc },
      { available: 0, occupied: 0, maintenance: 0, reserved: 0 },
    ),
    [units],
  )

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Typography
          variant="h5"
          sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', fontWeight: 700, flexGrow: 1 }}
        >
          Units
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<MapIcon />}
          onClick={() => router.push('/admin/units/sitemap')}
          sx={{ borderColor: '#EDE5D8' }}
        >
          Sitemap
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<GridViewIcon />}
          onClick={() => router.push('/admin/units/floor-plan')}
          sx={{ borderColor: '#EDE5D8' }}
        >
          Floor Plan
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => router.push('/admin/units/new')}
        >
          New Unit
        </Button>
      </Box>

      {/* Status summary — clickable to filter */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        {(Object.keys(STATUS_COLORS) as UnitStatus[]).map((s) => {
          const sc = STATUS_COLORS[s]
          const active = statusFilter === s
          return (
            <Box
              key={s}
              onClick={() => setStatusFilter(active ? 'all' : s)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.5, py: 0.75, borderRadius: 1,
                bgcolor: sc.bg,
                border: `1px solid ${active ? sc.color : sc.border}`,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                fontWeight: active ? 700 : 400,
              }}
            >
              <Typography variant="body2" sx={{ color: sc.color, fontWeight: active ? 700 : 600 }}>
                {STATUS_LABELS[s]}
              </Typography>
              <Typography variant="body2" sx={{ color: sc.color, opacity: 0.8 }}>
                {counts[s]}
              </Typography>
            </Box>
          )
        })}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          {loading ? (
            <CircularProgress size={16} />
          ) : (
            <IconButton size="small" onClick={fetchUnits} title="Refresh">
              <RefreshIcon fontSize="small" />
            </IconButton>
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {units.length} total units
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3, border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="available">Available</MenuItem>
                <MenuItem value="occupied">Occupied</MenuItem>
                <MenuItem value="maintenance">Maintenance</MenuItem>
                <MenuItem value="reserved">Reserved</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Type</InputLabel>
              <Select label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
                <MenuItem value="all">All types</MenuItem>
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="climate_controlled">Climate Controlled</MenuItem>
                <MenuItem value="drive_up">Drive-Up</MenuItem>
                <MenuItem value="vehicle_outdoor">Vehicle / Outdoor</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Size</InputLabel>
              <Select label="Size" value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
                <MenuItem value="all">All sizes</MenuItem>
                {allSizes.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto' }}>
              {filtered.length} unit{filtered.length !== 1 ? 's' : ''} shown
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={<Button color="inherit" size="small" onClick={fetchUnits}>Retry</Button>}
        >
          {error}
        </Alert>
      )}

      {/* Grid */}
      {loading ? (
        <UnitsSkeleton />
      ) : (
        <>
          <Grid container spacing={1.5}>
            {filtered.map((unit) => (
              <Grid item key={unit._id} xs={6} sm={4} md={3} lg={2}>
                <Tooltip
                  title={tenantName(unit) ? `${tenantName(unit)} · ${formatMoney(unit.price)}/mo` : `${STATUS_LABELS[unit.status]} · ${formatMoney(unit.price)}/mo`}
                  arrow
                  placement="top"
                >
                  <Box>
                    <UnitCard unit={unit} onClick={() => router.push(`/admin/units/${unit._id}`)} />
                  </Box>
                </Tooltip>
              </Grid>
            ))}
          </Grid>

          {filtered.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                No units match the current filters.
              </Typography>
            </Box>
          )}

          {/* Legend */}
          {units.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 3, pt: 2, borderTop: '1px solid #EDE5D8' }}>
              {(Object.keys(STATUS_COLORS) as UnitStatus[]).map((s) => (
                <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: STATUS_COLORS[s].border }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{STATUS_LABELS[s]}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  )
}
