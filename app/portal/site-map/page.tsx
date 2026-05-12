'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Popover,
  Typography,
  IconButton,
  Divider,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { formatMoney } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_COLS = 20
const GRID_ROWS = 12
const CELL_SIZE = 56

const STATUS_CONFIG: Record<string, { bg: string; border: string; color: string; label: string }> = {
  available:   { bg: '#D1FAE5', border: '#6EE7B7', color: '#065F46', label: 'Available' },
  occupied:    { bg: '#DBEAFE', border: '#93C5FD', color: '#1E3A5F', label: 'Occupied' },
  maintenance: { bg: '#FEF3C7', border: '#FCD34D', color: '#92400E', label: 'Maintenance' },
  reserved:    { bg: '#EDE9FE', border: '#C4B5FD', color: '#3B0764', label: 'Reserved' },
}

const TYPE_LABELS: Record<string, string> = {
  standard:           'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up:           'Drive-Up',
  vehicle_outdoor:    'Boat, RV & Vehicle',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface UnitCell {
  _id: string
  unitNumber: string
  size: string
  sqft: number
  type: string
  price: number
  status: string
  features: string[]
  gridX?: number
  gridY?: number
  gridFloor?: number
}

// ── Unit detail popover ────────────────────────────────────────────────────────

function UnitPopover({ unit, onClose }: { unit: UnitCell; onClose: () => void }) {
  const sc = STATUS_CONFIG[unit.status] ?? STATUS_CONFIG.available

  return (
    <Box sx={{ width: 260, overflow: 'hidden' }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: sc.bg,
          borderBottom: `1px solid ${sc.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, color: sc.color, fontSize: '0.875rem' }}>
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
            }}
          />
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: sc.color, p: 0.25 }}>
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
      <Box sx={{ px: 2, py: 1.5 }}>
        {[
          { label: 'Size', value: unit.size },
          { label: 'Type', value: TYPE_LABELS[unit.type] ?? unit.type },
          { label: 'Area', value: `${unit.sqft} sq ft` },
          { label: 'Rate', value: unit.status === 'available' ? `${formatMoney(unit.price)}/mo` : '—' },
        ].map(({ label, value }) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 500 }}>{value}</Typography>
          </Box>
        ))}
        {unit.features.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {unit.features.slice(0, 4).map((f) => (
                <Chip
                  key={f}
                  label={f}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 18, '& .MuiChip-label': { px: 0.75 } }}
                />
              ))}
            </Box>
          </>
        )}
      </Box>
      {unit.status === 'available' && (
        <>
          <Divider />
          <Box sx={{ px: 2, py: 1 }}>
            <Button
              component={Link}
              href={`/units/${unit._id}`}
              size="small"
              variant="contained"
              fullWidth
              sx={{
                fontSize: '0.75rem',
                bgcolor: '#B8914A',
                color: '#1C0F06',
                fontWeight: 700,
                '&:hover': { bgcolor: '#a07c3e' },
              }}
            >
              Reserve This Unit
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortalSiteMapPage() {
  const [units, setUnits] = useState<UnitCell[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentFloor, setCurrentFloor] = useState(1)
  const [popoverUnit, setPopoverUnit] = useState<UnitCell | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null)

  useEffect(() => {
    fetch('/api/units?limit=200')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setUnits(j.data.items ?? [])
        else setError(j.error ?? 'Failed to load')
      })
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

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

  const floors = useMemo(() => {
    const s = new Set<number>()
    for (const u of units) {
      if (typeof u.gridFloor === 'number') s.add(u.gridFloor)
    }
    const arr = Array.from(s).sort()
    return arr.length > 0 ? arr : [1]
  }, [units])

  const gridMap = useMemo(() => {
    const map = new Map<string, UnitCell>()
    for (const u of units) {
      if (
        typeof u.gridX === 'number' &&
        typeof u.gridY === 'number' &&
        typeof u.gridFloor === 'number' &&
        u.gridFloor === currentFloor
      ) {
        map.set(`${u.gridX}:${u.gridY}`, u)
      }
    }
    return map
  }, [units, currentFloor])

  const counts = useMemo(() => {
    const c = { available: 0, occupied: 0, maintenance: 0, reserved: 0 }
    for (const u of units) {
      if (u.status in c) c[u.status as keyof typeof c]++
    }
    return c
  }, [units])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, gap: 2 }}>
        <CircularProgress sx={{ color: '#B8914A' }} size={28} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading site map…</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 480, mt: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Failed to load site map</Typography>
          <Typography variant="caption">{error}</Typography>
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: 'secondary.main', mb: 0.5 }}
        >
          Site Map
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Visual layout of all storage units — click any unit for details
        </Typography>
      </Box>

      {/* Legend + floor tabs */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
            <Chip
              key={status}
              label={`${cfg.label} (${counts[status as keyof typeof counts] ?? 0})`}
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
          ))}
        </Box>
        {floors.length > 1 && (
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
            {floors.map((f) => (
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
                  minWidth: 72,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  ...(currentFloor === f
                    ? { bgcolor: '#B8914A', color: '#1C0F06', '&:hover': { bgcolor: '#a07c3e' } }
                    : { borderColor: '#B8914A', color: '#B8914A', '&:hover': { borderColor: '#a07c3e', bgcolor: 'rgba(184,145,74,0.06)' } }),
                }}
              >
                Floor {f}
              </Button>
            ))}
          </Box>
        )}
      </Box>

      {/* Grid */}
      <Box
        sx={{
          overflowX: 'auto',
          border: '1px solid #EDE5D8',
          borderRadius: 2,
          bgcolor: '#F1F5F9',
          p: 1,
          mb: 1,
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
              const unit = gridMap.get(key) ?? null
              const sc = unit ? STATUS_CONFIG[unit.status] : null

              return (
                <Box
                  key={key}
                  onClick={(e) => {
                    if (unit) {
                      setPopoverUnit(unit)
                      setPopoverAnchor(e.currentTarget as HTMLElement)
                    }
                  }}
                  sx={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    flexShrink: 0,
                    border: `1px solid ${sc?.border ?? '#E2E8F0'}`,
                    bgcolor: sc?.bg ?? '#F8FAFC',
                    cursor: unit ? 'pointer' : 'default',
                    position: 'relative',
                    boxSizing: 'border-box',
                    p: '3px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'box-shadow 0.12s',
                    ...(unit
                      ? { '&:hover': { boxShadow: '0 2px 10px rgba(0,0,0,0.18)', zIndex: 1 } }
                      : { '&:hover': { bgcolor: '#EFF6FF' } }),
                  }}
                >
                  {unit && sc ? (
                    <>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.62rem',
                          color: sc.color,
                          lineHeight: 1.1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {unit.unitNumber}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.57rem',
                          color: sc.color,
                          opacity: 0.75,
                          lineHeight: 1.1,
                        }}
                      >
                        {unit.size}
                      </Typography>
                    </>
                  ) : null}
                </Box>
              )
            })
          )}
        </Box>
      </Box>

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 3 }}>
        Click any colored unit cell to see details &bull; Available units can be reserved online
      </Typography>

      {/* CTA for available units */}
      {counts.available > 0 && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: '#D1FAE5',
            border: '1px solid #6EE7B7',
          }}
        >
          <Typography variant="body2" sx={{ color: '#065F46', fontWeight: 500 }}>
            {counts.available} unit{counts.available !== 1 ? 's' : ''} currently available
          </Typography>
          <Button
            component={Link}
            href="/units"
            size="small"
            variant="contained"
            sx={{ bgcolor: '#065F46', color: 'white', fontWeight: 600, '&:hover': { bgcolor: '#047857' } }}
          >
            Browse &amp; Reserve
          </Button>
        </Box>
      )}

      {/* Detail Popover */}
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
          <UnitPopover
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
