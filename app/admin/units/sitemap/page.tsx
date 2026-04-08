'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Popover,
  Typography,
} from '@mui/material'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import DriveEtaIcon from '@mui/icons-material/DriveEta'
import InventoryIcon from '@mui/icons-material/Inventory'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import CloseIcon from '@mui/icons-material/Close'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { formatMoney, formatDate } from '@/lib/utils'
import type { Unit, UnitStatus, UnitType } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_COLS = 20
const GRID_ROWS = 12
const CELL_SIZE = 64   // px
const FLOORS = [1, 2]

// ── Theme tokens ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  UnitStatus,
  { bg: string; border: string; color: string; label: string }
> = {
  available:   { bg: '#D1FAE5', border: '#6EE7B7', color: '#065F46', label: 'Available' },
  occupied:    { bg: '#DBEAFE', border: '#93C5FD', color: '#1E3A5F', label: 'Occupied' },
  maintenance: { bg: '#FEF3C7', border: '#FCD34D', color: '#92400E', label: 'Maintenance' },
  reserved:    { bg: '#EDE9FE', border: '#C4B5FD', color: '#3B0764', label: 'Reserved' },
}

const EMPTY_CELL = { bg: '#F8FAFC', border: '#E2E8F0' }

const TYPE_LABELS: Record<UnitType, string> = {
  standard:           'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up:           'Drive-Up',
  vehicle_outdoor:    'Vehicle / Outdoor',
}

// ── Populated field shapes (from API when populated) ──────────────────────────

interface TenantObj {
  _id: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface LeaseObj {
  _id: string
  startDate: string
  endDate?: string
  status: string
  monthlyRate: number
}

// ── Unit with optional grid fields and possibly-populated refs ─────────────────

interface UnitWithGrid extends Unit {
  gridX?: number
  gridY?: number
  gridFloor?: number
  // These may be populated objects or bare ObjectId strings
  currentTenantId?: TenantObj | string
  currentLeaseId?: LeaseObj | string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTenant(unit: UnitWithGrid): TenantObj | null {
  if (!unit.currentTenantId) return null
  if (typeof unit.currentTenantId === 'object') return unit.currentTenantId as TenantObj
  return null
}

function getLease(unit: UnitWithGrid): LeaseObj | null {
  if (!unit.currentLeaseId) return null
  if (typeof unit.currentLeaseId === 'object') return unit.currentLeaseId as LeaseObj
  return null
}

// ── Type icon ─────────────────────────────────────────────────────────────────

function TypeIcon({ type, fontSize = 14 }: { type: UnitType; fontSize?: number }) {
  const sx = { fontSize, opacity: 0.85 }
  switch (type) {
    case 'climate_controlled': return <AcUnitIcon sx={sx} />
    case 'drive_up':           return <DriveEtaIcon sx={sx} />
    case 'vehicle_outdoor':    return <DirectionsCarIcon sx={sx} />
    default:                   return <InventoryIcon sx={sx} />
  }
}

// ── Grid cell ──────────────────────────────────────────────────────────────────

interface GridCellProps {
  unit: UnitWithGrid | null
  onClick: (el: HTMLElement) => void
}

function GridCell({ unit, onClick }: GridCellProps) {
  const isEmpty = !unit
  const sc = unit ? STATUS_CONFIG[unit.status] : null
  const tenant = unit ? getTenant(unit) : null

  const bg     = isEmpty ? EMPTY_CELL.bg     : sc!.bg
  const border = isEmpty ? EMPTY_CELL.border : sc!.border
  const cursor = isEmpty ? 'default'         : 'pointer'

  return (
    <Box
      onClick={(e) => {
        if (unit) onClick(e.currentTarget as HTMLElement)
      }}
      sx={{
        width: CELL_SIZE,
        height: CELL_SIZE,
        flexShrink: 0,
        border: `1px solid ${border}`,
        bgcolor: bg,
        cursor,
        position: 'relative',
        boxSizing: 'border-box',
        p: '4px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'box-shadow 0.12s, opacity 0.12s',
        ...(isEmpty
          ? {
              '&:hover': { bgcolor: '#EFF6FF' },
            }
          : {
              '&:hover': {
                boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                zIndex: 1,
              },
            }),
      }}
    >
      {unit && sc ? (
        <>
          {/* Top row: unit number (left) + tenant first name (right) */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '0.7rem',
                color: sc.color,
                lineHeight: 1.1,
                maxWidth: tenant ? '55%' : '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {unit.unitNumber}
            </Typography>
            {tenant && (
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  color: sc.color,
                  opacity: 0.85,
                  lineHeight: 1.1,
                  maxWidth: '45%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}
              >
                {tenant.firstName}
              </Typography>
            )}
          </Box>

          {/* Bottom row: size (left) + type icon (right) */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Typography
              sx={{
                fontSize: '0.65rem',
                color: sc.color,
                opacity: 0.75,
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '70%',
              }}
            >
              {unit.size}
            </Typography>
            <Box sx={{ color: sc.color, display: 'flex', alignItems: 'center' }}>
              <TypeIcon type={unit.type} fontSize={13} />
            </Box>
          </Box>
        </>
      ) : null}
    </Box>
  )
}

// ── Unit detail popover ────────────────────────────────────────────────────────

interface UnitPopoverProps {
  unit: UnitWithGrid
  onClose: () => void
}

function UnitDetailPopover({ unit, onClose }: UnitPopoverProps) {
  const sc      = STATUS_CONFIG[unit.status]
  const tenant  = getTenant(unit)
  const lease   = getLease(unit)

  return (
    <Box sx={{ width: 300, p: 0, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: sc.bg,
          borderBottom: `1px solid ${sc.border}`,
          borderRadius: '4px 4px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box sx={{ color: sc.color, display: 'flex', flexShrink: 0 }}>
            <TypeIcon type={unit.type} fontSize={16} />
          </Box>
          <Typography
            sx={{
              fontWeight: 700,
              color: sc.color,
              fontSize: '0.9rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Unit {unit.unitNumber}
          </Typography>
          <Chip
            label={sc.label}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.6rem',
              fontWeight: 700,
              bgcolor: sc.bg,
              color: sc.color,
              border: `1px solid ${sc.border}`,
              '& .MuiChip-label': { px: 0.75 },
              flexShrink: 0,
            }}
          />
        </Box>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: sc.color, p: 0.25, flexShrink: 0 }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ px: 2, py: 1.5 }}>
        {/* Unit details */}
        {(
          [
            { label: 'Size',         value: unit.size },
            { label: 'Type',         value: TYPE_LABELS[unit.type] },
            { label: 'Floor',        value: `Floor ${unit.gridFloor ?? '—'}` },
            {
              label: 'Monthly Rate',
              value: unit.price ? formatMoney(unit.price) + '/mo' : '—',
            },
          ] as { label: string; value: string }[]
        ).map(({ label, value }) => (
          <Box
            key={label}
            sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {label}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.primary' }}>
              {value}
            </Typography>
          </Box>
        ))}

        <Divider sx={{ my: 1.25 }} />

        {/* Tenant section */}
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.6rem' }}
        >
          Tenant
        </Typography>
        {tenant ? (
          <Box sx={{ mt: 0.5 }}>
            {(
              [
                { label: 'Name',  value: `${tenant.firstName} ${tenant.lastName}` },
                { label: 'Phone', value: tenant.phone || '—' },
                { label: 'Email', value: tenant.email || '—' },
              ] as { label: string; value: string }[]
            ).map(({ label, value }) => (
              <Box
                key={label}
                sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 500,
                    color: 'text.primary',
                    maxWidth: 160,
                    textAlign: 'right',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            —
          </Typography>
        )}

        <Divider sx={{ my: 1.25 }} />

        {/* Lease section */}
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.6rem' }}
        >
          Lease
        </Typography>
        {lease ? (
          <Box sx={{ mt: 0.5 }}>
            {(
              [
                {
                  label: 'Period',
                  value: `${formatDate(lease.startDate)} → ${lease.endDate ? formatDate(lease.endDate) : 'Ongoing'}`,
                },
                { label: 'Lease Status', value: lease.status.replace('_', ' ') },
                ...(lease.status === 'active'
                  ? [{ label: 'Next Payment', value: formatMoney(lease.monthlyRate) }]
                  : []),
              ] as { label: string; value: string }[]
            ).map(({ label, value }) => (
              <Box
                key={label}
                sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 500,
                    color: 'text.primary',
                    maxWidth: 160,
                    textAlign: 'right',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textTransform: 'capitalize',
                  }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            —
          </Typography>
        )}
      </Box>

      <Divider />

      {/* Footer actions */}
      <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1 }}>
        <Button
          component={Link}
          href={`/admin/units/${unit._id}`}
          size="small"
          variant="contained"
          sx={{
            flex: 1,
            fontSize: '0.75rem',
            bgcolor: '#B8914A',
            color: '#1C0F06',
            fontWeight: 700,
            '&:hover': { bgcolor: '#a07c3e' },
          }}
        >
          View Unit
        </Button>
        <Button
          component={Link}
          href={`/admin/units/${unit._id}/edit`}
          size="small"
          variant="outlined"
          sx={{
            flex: 1,
            fontSize: '0.75rem',
            borderColor: '#B8914A',
            color: '#B8914A',
            fontWeight: 600,
            '&:hover': {
              borderColor: '#a07c3e',
              bgcolor: 'rgba(184,145,74,0.06)',
            },
          }}
        >
          Edit
        </Button>
      </Box>
    </Box>
  )
}

// ── Unplaced units section ─────────────────────────────────────────────────────

interface UnplacedSectionProps {
  units: UnitWithGrid[]
}

function UnplacedSection({ units }: UnplacedSectionProps) {
  const [open, setOpen] = useState(false)

  if (units.length === 0) return null

  return (
    <Box
      sx={{
        mt: 2,
        border: '1px solid #EDE5D8',
        borderRadius: 2,
        bgcolor: '#FAF7F2',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          borderBottom: open ? '1px solid #EDE5D8' : 'none',
          '&:hover': { bgcolor: '#F5EFE6' },
          transition: 'background-color 0.1s',
        }}
      >
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '0.85rem',
            color: '#1C0F06',
            flex: 1,
          }}
        >
          Unplaced Units
        </Typography>
        <Chip
          label={units.length}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 700,
            bgcolor: '#B8914A',
            color: '#1C0F06',
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
        {open ? (
          <ExpandLessIcon sx={{ fontSize: 18, color: '#92400E' }} />
        ) : (
          <ExpandMoreIcon sx={{ fontSize: 18, color: '#92400E' }} />
        )}
      </Box>

      <Collapse in={open}>
        <Box sx={{ p: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            These units have no grid position assigned.{' '}
            <Link
              href="/admin/units/floor-plan"
              style={{ color: '#B8914A', fontWeight: 600, textDecoration: 'none' }}
            >
              Go to editor
            </Link>{' '}
            to assign positions.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {units.map((unit) => {
              const sc = STATUS_CONFIG[unit.status]
              return (
                <Box
                  key={unit._id}
                  component={Link}
                  href={`/admin/units/${unit._id}`}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    border: `1px solid ${sc.border}`,
                    bgcolor: sc.bg,
                    textDecoration: 'none',
                    transition: 'box-shadow 0.12s',
                    '&:hover': {
                      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  <Box sx={{ color: sc.color, display: 'flex' }}>
                    <TypeIcon type={unit.type} fontSize={12} />
                  </Box>
                  <Typography
                    sx={{ fontSize: '0.72rem', fontWeight: 700, color: sc.color }}
                  >
                    {unit.unitNumber}
                  </Typography>
                  <Typography
                    sx={{ fontSize: '0.65rem', color: sc.color, opacity: 0.75 }}
                  >
                    {unit.size}
                  </Typography>
                  <Chip
                    label={sc.label}
                    size="small"
                    sx={{
                      height: 14,
                      fontSize: '0.55rem',
                      fontWeight: 600,
                      bgcolor: sc.bg,
                      color: sc.color,
                      border: `1px solid ${sc.border}`,
                      '& .MuiChip-label': { px: 0.5 },
                    }}
                  />
                </Box>
              )
            })}
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SiteMapPage() {
  // ── Data state ──
  const [units, setUnits] = useState<UnitWithGrid[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ── View state ──
  const [currentFloor, setCurrentFloor] = useState<number>(1)

  // ── Popover state ──
  const [popoverUnit, setPopoverUnit] = useState<UnitWithGrid | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null)

  // ── Load units ────────────────────────────────────────────────────────────

  function load() {
    const controller = new AbortController()
    setLoading(true)
    setFetchError(null)

    fetch('/api/units?limit=200', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (!json.success) throw new Error(json.error ?? 'Failed to load units')
        setUnits(json.data.items as UnitWithGrid[])
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return
        setFetchError((err as Error).message ?? 'Unknown error')
      })
      .finally(() => setLoading(false))

    return controller
  }

  useEffect(() => {
    const controller = load()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Escape key closes popover ──────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPopoverUnit(null)
        setPopoverAnchor(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Derived data ───────────────────────────────────────────────────────────

  const currentGridMap = useMemo(() => {
    const map = new Map<string, UnitWithGrid>()
    for (const unit of units) {
      if (
        typeof unit.gridX === 'number' &&
        typeof unit.gridY === 'number' &&
        typeof unit.gridFloor === 'number' &&
        unit.gridFloor === currentFloor
      ) {
        map.set(`${unit.gridX}:${unit.gridY}`, unit)
      }
    }
    return map
  }, [units, currentFloor])

  const unplacedUnits = useMemo(
    () =>
      units.filter(
        (u) =>
          typeof u.gridX !== 'number' ||
          typeof u.gridY !== 'number' ||
          typeof u.gridFloor !== 'number'
      ),
    [units]
  )

  // ── Status summary counts (all units, not just current floor) ──────────────

  const counts = useMemo(() => {
    const c = { available: 0, occupied: 0, maintenance: 0, reserved: 0 }
    for (const u of units) {
      if (u.status in c) c[u.status as UnitStatus]++
    }
    return c
  }, [units])

  // ── Render: loading / error ────────────────────────────────────────────────

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 400,
          gap: 2,
        }}
      >
        <CircularProgress sx={{ color: '#B8914A' }} size={28} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Loading site map…
        </Typography>
      </Box>
    )
  }

  if (fetchError) {
    return (
      <Box sx={{ maxWidth: 560, mt: 4 }}>
        <Alert
          severity="error"
          sx={{ borderRadius: 2 }}
          action={
            <Button
              size="small"
              color="error"
              onClick={() => load()}
              sx={{ fontWeight: 600 }}
            >
              Retry
            </Button>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Failed to load units
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            {fetchError}
          </Typography>
        </Alert>
      </Box>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── Header row ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
          mb: 2,
        }}
      >
        {/* Title */}
        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: '1.6rem',
              color: '#1C0F06',
              lineHeight: 1.1,
              mb: 0.5,
            }}
          >
            Site Map
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {counts.available} available &middot; {counts.occupied} occupied &middot;{' '}
            {counts.maintenance} maintenance &middot; {counts.reserved} reserved
          </Typography>
        </Box>

        {/* Floor tabs */}
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {FLOORS.map((f) => (
            <Button
              key={f}
              size="small"
              variant={currentFloor === f ? 'contained' : 'outlined'}
              onClick={() => {
                setCurrentFloor(f)
                setPopoverUnit(null)
                setPopoverAnchor(null)
              }}
              sx={{
                minWidth: 80,
                fontWeight: 600,
                fontSize: '0.78rem',
                ...(currentFloor === f
                  ? {
                      bgcolor: '#B8914A',
                      color: '#1C0F06',
                      '&:hover': { bgcolor: '#a07c3e' },
                    }
                  : {
                      borderColor: '#B8914A',
                      color: '#B8914A',
                      '&:hover': {
                        borderColor: '#a07c3e',
                        bgcolor: 'rgba(184,145,74,0.06)',
                      },
                    }),
              }}
            >
              Floor {f}
            </Button>
          ))}
        </Box>

        {/* Edit Layout button */}
        <Button
          component={Link}
          href="/admin/units/floor-plan"
          size="small"
          variant="outlined"
          startIcon={<EditOutlinedIcon fontSize="small" />}
          sx={{
            borderColor: '#EDE5D8',
            color: '#1C0F06',
            fontWeight: 500,
            fontSize: '0.78rem',
            '&:hover': { borderColor: '#B8914A', bgcolor: 'rgba(184,145,74,0.04)' },
          }}
        >
          Edit Layout
        </Button>
      </Box>

      {/* ── Legend row ── */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {(Object.entries(STATUS_CONFIG) as [UnitStatus, (typeof STATUS_CONFIG)[UnitStatus]][]).map(
          ([status, cfg]) => (
            <Chip
              key={status}
              label={cfg.label}
              size="small"
              sx={{
                bgcolor: cfg.bg,
                color: cfg.color,
                border: `1px solid ${cfg.border}`,
                fontWeight: 600,
                fontSize: '0.72rem',
                height: 22,
                '& .MuiChip-label': { px: 1 },
              }}
            />
          )
        )}
      </Box>

      {/* ── Grid ── */}
      <Box
        sx={{
          overflowX: 'auto',
          border: '1px solid #EDE5D8',
          borderRadius: 2,
          bgcolor: '#F1F5F9',
          p: 1,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_SIZE}px)`,
            gap: '2px',
            width: 'fit-content',
          }}
        >
          {Array.from({ length: GRID_ROWS }, (_, row) =>
            Array.from({ length: GRID_COLS }, (_, col) => {
              const key = `${col}:${row}`
              const unit = currentGridMap.get(key) ?? null
              return (
                <GridCell
                  key={key}
                  unit={unit}
                  onClick={(el) => {
                    setPopoverUnit(unit)
                    setPopoverAnchor(el)
                  }}
                />
              )
            })
          )}
        </Box>
      </Box>

      {/* ── Grid footer ── */}
      <Box sx={{ mt: 1, mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {GRID_COLS} columns &times; {GRID_ROWS} rows &nbsp;&middot;&nbsp; Click a unit cell for details
        </Typography>
      </Box>

      {/* ── Unplaced units ── */}
      <UnplacedSection units={unplacedUnits} />

      {/* ── Detail popover ── */}
      <Popover
        open={Boolean(popoverAnchor && popoverUnit)}
        anchorEl={popoverAnchor}
        onClose={() => {
          setPopoverUnit(null)
          setPopoverAnchor(null)
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
            border: '1px solid #EDE5D8',
            overflow: 'hidden',
          },
        }}
      >
        {popoverUnit && (
          <UnitDetailPopover
            unit={popoverUnit}
            onClose={() => {
              setPopoverUnit(null)
              setPopoverAnchor(null)
            }}
          />
        )}
      </Popover>
    </Box>
  )
}
