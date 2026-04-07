'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Popover,
  Snackbar,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import DriveEtaIcon from '@mui/icons-material/DriveEta'
import InventoryIcon from '@mui/icons-material/Inventory'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import PlaceIcon from '@mui/icons-material/Place'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { formatMoney } from '@/lib/utils'
import type { Unit, UnitStatus, UnitType } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_COLS = 20
const GRID_ROWS = 12
const CELL_SIZE = 60      // px
const FLOORS = [1, 2]

// ── Theme tokens ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<UnitStatus, { bg: string; border: string; color: string; label: string }> = {
  available:   { bg: '#D1FAE5', border: '#6EE7B7', color: '#065F46', label: 'Available' },
  occupied:    { bg: '#DBEAFE', border: '#93C5FD', color: '#1E3A5F', label: 'Occupied' },
  maintenance: { bg: '#FEF3C7', border: '#FCD34D', color: '#92400E', label: 'Maintenance' },
  reserved:    { bg: '#EDE9FE', border: '#C4B5FD', color: '#3B0764', label: 'Reserved' },
}

const EMPTY_CELL = { bg: '#F9FAFB', border: '#E5E7EB' }

const TYPE_LABELS: Record<UnitType, string> = {
  standard:           'Standard',
  climate_controlled: 'Climate',
  drive_up:           'Drive-Up',
  vehicle_outdoor:    'Vehicle',
}

// ── Derived type with grid fields included ────────────────────────────────────

interface UnitWithGrid extends Unit {
  gridX?: number
  gridY?: number
  gridFloor?: number
}

// ── Position state: keyed by unit _id ─────────────────────────────────────────

interface GridPosition {
  gridX: number
  gridY: number
  gridFloor: number
}

type PositionMap = Record<string, GridPosition>

// ── Type icon ─────────────────────────────────────────────────────────────────

function TypeIcon({ type, size = 'small' }: { type: UnitType; size?: 'small' | 'inherit' }) {
  const sx = { fontSize: size === 'small' ? 14 : 16, opacity: 0.8 }
  switch (type) {
    case 'climate_controlled': return <AcUnitIcon sx={sx} />
    case 'drive_up':           return <DriveEtaIcon sx={sx} />
    case 'vehicle_outdoor':    return <DirectionsCarIcon sx={sx} />
    default:                   return <InventoryIcon sx={sx} />
  }
}

// ── Sidebar unit chip ──────────────────────────────────────────────────────────

interface SidebarChipProps {
  unit: UnitWithGrid
  selected: boolean
  onClick: () => void
}

function SidebarChip({ unit, selected, onClick }: SidebarChipProps) {
  const sc = STATUS_CONFIG[unit.status]
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 0.75,
        borderRadius: 1,
        border: `2px solid ${selected ? '#B8914A' : sc.border}`,
        bgcolor: selected ? '#FEF3C7' : sc.bg,
        cursor: 'pointer',
        transition: 'all 0.12s',
        outline: selected ? '2px solid #B8914A' : 'none',
        outlineOffset: 1,
        '&:hover': {
          borderColor: '#B8914A',
          boxShadow: '0 2px 8px rgba(184,145,74,0.2)',
        },
      }}
    >
      <Box sx={{ color: sc.color, display: 'flex', alignItems: 'center' }}>
        <TypeIcon type={unit.type} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: sc.color, display: 'block', lineHeight: 1.2 }}
        >
          {unit.unitNumber}
        </Typography>
        <Typography variant="caption" sx={{ color: sc.color, opacity: 0.75, fontSize: '0.65rem' }}>
          {unit.size}
        </Typography>
      </Box>
      <Chip
        label={sc.label}
        size="small"
        sx={{
          height: 16,
          fontSize: '0.6rem',
          fontWeight: 600,
          bgcolor: sc.bg,
          color: sc.color,
          border: `1px solid ${sc.border}`,
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    </Box>
  )
}

// ── Grid cell popover content ──────────────────────────────────────────────────

interface CellPopoverProps {
  unit: UnitWithGrid
  position: GridPosition
  onRemove: () => void
  onClose: () => void
}

function CellPopover({ unit, position, onRemove, onClose }: CellPopoverProps) {
  const sc = STATUS_CONFIG[unit.status]
  return (
    <Box sx={{ width: 240, p: 0 }}>
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: sc.bg,
          borderBottom: `1px solid ${sc.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: '4px 4px 0 0',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ color: sc.color }}>
            <TypeIcon type={unit.type} size="inherit" />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: sc.color }}>
            Unit {unit.unitNumber}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: sc.color, p: 0.25 }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ px: 2, py: 1.5 }}>
        {[
          { label: 'Size',     value: unit.size },
          { label: 'Type',     value: TYPE_LABELS[unit.type] },
          { label: 'Status',   value: sc.label },
          { label: 'Price',    value: `${formatMoney(unit.price)}/mo` },
          { label: 'Position', value: `Col ${position.gridX + 1}, Row ${position.gridY + 1}` },
          { label: 'Floor',    value: `Floor ${position.gridFloor}` },
        ].map(({ label, value }) => (
          <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {label}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.primary' }}>
              {value}
            </Typography>
          </Box>
        ))}

        {unit.notes && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ color: '#92400E', fontStyle: 'italic' }}>
              {unit.notes}
            </Typography>
          </>
        )}
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ px: 2, py: 1 }}>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineIcon fontSize="small" />}
          onClick={onRemove}
          sx={{ borderRadius: 1, fontSize: '0.75rem' }}
        >
          Remove from grid
        </Button>
      </Box>
    </Box>
  )
}

// ── Grid cell ──────────────────────────────────────────────────────────────────

interface GridCellProps {
  col: number
  row: number
  unit: UnitWithGrid | null
  isSelectingMode: boolean
  onClick: (col: number, row: number, el: HTMLElement) => void
}

function GridCell({ col, row, unit, isSelectingMode, onClick }: GridCellProps) {
  const isEmpty = !unit
  const sc = unit ? STATUS_CONFIG[unit.status] : null

  let bg = EMPTY_CELL.bg
  let border = EMPTY_CELL.border
  let cursor = 'default'

  if (unit) {
    bg = sc!.bg
    border = sc!.border
    cursor = 'pointer'
  } else if (isSelectingMode) {
    cursor = 'crosshair'
  }

  return (
    <Box
      onClick={(e) => onClick(col, row, e.currentTarget as HTMLElement)}
      sx={{
        width: CELL_SIZE,
        height: CELL_SIZE,
        flexShrink: 0,
        border: `1px solid ${border}`,
        bgcolor: bg,
        cursor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.25,
        position: 'relative',
        transition: 'all 0.1s',
        boxSizing: 'border-box',
        ...(isSelectingMode && isEmpty
          ? {
              '&:hover': {
                bgcolor: '#FEF3C7',
                borderColor: '#B8914A',
                boxShadow: 'inset 0 0 0 2px #B8914A',
              },
            }
          : {}),
        ...(unit
          ? {
              '&:hover': {
                opacity: 0.85,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 1,
              },
            }
          : {}),
      }}
    >
      {unit && sc ? (
        <>
          <Box sx={{ color: sc.color, lineHeight: 1 }}>
            <TypeIcon type={unit.type} />
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: sc.color,
              fontSize: '0.65rem',
              lineHeight: 1,
              textAlign: 'center',
              px: 0.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: CELL_SIZE - 4,
            }}
          >
            {unit.unitNumber}
          </Typography>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: sc.border,
            }}
          />
        </>
      ) : (
        isSelectingMode && (
          <PlaceIcon sx={{ fontSize: 16, color: '#D1D5DB', opacity: 0.6 }} />
        )
      )}
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FloorPlanPage() {
  // ── Data state ──
  const [units, setUnits] = useState<UnitWithGrid[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ── Editor state ──
  const [currentFloor, setCurrentFloor] = useState<number>(1)
  const [positions, setPositions] = useState<PositionMap>({})
  const [selectedUnit, setSelectedUnit] = useState<UnitWithGrid | null>(null)  // from sidebar — placing mode

  // ── Popover state ──
  const [popoverUnit, setPopoverUnit] = useState<UnitWithGrid | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null)

  // ── Save state ──
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Dirty tracking ──
  const [isDirty, setIsDirty] = useState(false)

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setFetchError(null)
      try {
        const res = await fetch('/api/units?limit=200', { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!json.success) throw new Error(json.error ?? 'Failed to load units')

        const rawUnits: UnitWithGrid[] = json.data.items

        // Build initial position map from units that have grid coords
        const initPositions: PositionMap = {}
        for (const u of rawUnits) {
          if (
            typeof u.gridX === 'number' &&
            typeof u.gridY === 'number' &&
            typeof u.gridFloor === 'number'
          ) {
            initPositions[u._id] = {
              gridX: u.gridX,
              gridY: u.gridY,
              gridFloor: u.gridFloor,
            }
          }
        }

        setUnits(rawUnits)
        setPositions(initPositions)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setFetchError((err as Error).message ?? 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [])

  // ── Derived: build grid lookup for current floor ──────────────────────────

  // posKey "col:row" → unit, for cells on the current floor
  const currentGridMap = useMemo<Map<string, UnitWithGrid>>(() => {
    const map = new Map<string, UnitWithGrid>()
    for (const [unitId, pos] of Object.entries(positions)) {
      if (pos.gridFloor !== currentFloor) continue
      const unit = units.find((u) => u._id === unitId)
      if (unit) {
        map.set(`${pos.gridX}:${pos.gridY}`, unit)
      }
    }
    return map
  }, [positions, units, currentFloor])

  // ── Unplaced units: no position OR position on a different floor (not on currentFloor)
  // We show ALL units without a position in any floor, plus those on other floors
  // For sidebar: units that have NO position at all, OR a position on a different floor
  // (so you can move them). Actually spec says: "without gridX/gridY or with different floor"
  const unplacedOnCurrentFloor = units.filter((u) => {
    const pos = positions[u._id]
    if (!pos) return true                          // no position at all
    if (pos.gridFloor !== currentFloor) return true // placed on different floor
    return false
  })

  // ── Cell click handler ────────────────────────────────────────────────────

  function handleCellClick(col: number, row: number, el: HTMLElement) {
    const key = `${col}:${row}`
    const occupant = currentGridMap.get(key)

    if (occupant) {
      // Show popover for existing unit
      setSelectedUnit(null)
      setPopoverUnit(occupant)
      setPopoverAnchor(el)
      return
    }

    if (selectedUnit) {
      // Place the selected unit here
      setPositions((prev) => {
        // If unit was somewhere else on this floor, that old cell is freed automatically
        return {
          ...prev,
          [selectedUnit._id]: { gridX: col, gridY: row, gridFloor: currentFloor },
        }
      })
      setSelectedUnit(null)
      setIsDirty(true)
    }
  }

  // ── Remove unit from grid ─────────────────────────────────────────────────

  function handleRemoveFromGrid(unit: UnitWithGrid) {
    setPositions((prev) => {
      const next = { ...prev }
      delete next[unit._id]
      return next
    })
    setPopoverUnit(null)
    setPopoverAnchor(null)
    setIsDirty(true)
  }

  // ── Save positions ────────────────────────────────────────────────────────

  async function handleSave() {
    const posEntries = Object.entries(positions)
    if (posEntries.length === 0) {
      setSaveError('No units are placed on the grid yet.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const body = {
        positions: posEntries.map(([id, pos]) => ({
          id,
          gridX: pos.gridX,
          gridY: pos.gridY,
          gridFloor: pos.gridFloor,
        })),
      }

      const res = await fetch('/api/units/positions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }

      setSaveSuccess(true)
      setIsDirty(false)
    } catch (err) {
      setSaveError((err as Error).message ?? 'Failed to save positions')
    } finally {
      setSaving(false)
    }
  }

  // ── Cancel selection on Escape ────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedUnit(null)
        setPopoverUnit(null)
        setPopoverAnchor(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
        <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
          Loading units…
        </Typography>
      </Box>
    )
  }

  if (fetchError) {
    return (
      <Box sx={{ maxWidth: 560, mt: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Failed to load units
          </Typography>
          <Typography variant="caption">{fetchError}</Typography>
        </Alert>
      </Box>
    )
  }

  const isPlacingMode = !!selectedUnit

  // Stats for header
  const placedCount = Object.values(positions).filter((p) => p.gridFloor === currentFloor).length
  const totalUnits = units.length

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - 48px)', minHeight: 600 }}>

      {/* ── Top bar ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          mb: 2,
          flexShrink: 0,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1 }}>
            Floor Plan Editor
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {placedCount} unit{placedCount !== 1 ? 's' : ''} on floor {currentFloor} &middot; {totalUnits} total
          </Typography>
        </Box>

        {/* Floor tabs */}
        <Tabs
          value={currentFloor}
          onChange={(_, v) => {
            setCurrentFloor(v)
            setSelectedUnit(null)
            setPopoverUnit(null)
            setPopoverAnchor(null)
          }}
          sx={{
            ml: { xs: 0, sm: 'auto' },
            minHeight: 36,
            '& .MuiTab-root': {
              minHeight: 36,
              py: 0.5,
              px: 2,
              fontSize: '0.8rem',
              fontWeight: 500,
            },
            '& .MuiTabs-indicator': { bgcolor: '#B8914A' },
            '& .Mui-selected': { color: '#B8914A !important', fontWeight: 700 },
          }}
        >
          {FLOORS.map((f) => (
            <Tab key={f} label={`Floor ${f}`} value={f} />
          ))}
        </Tabs>

        {/* Save button */}
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !isDirty}
          sx={{
            bgcolor: '#B8914A',
            color: '#1C0F06',
            fontWeight: 700,
            px: 2.5,
            '&:hover': { bgcolor: '#a07c3e' },
            '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
          }}
        >
          {saving ? 'Saving…' : 'Save Layout'}
        </Button>
      </Box>

      {/* ── Placement mode banner ── */}
      {isPlacingMode && (
        <Paper
          elevation={0}
          sx={{
            mb: 1.5,
            px: 2,
            py: 1,
            bgcolor: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexShrink: 0,
          }}
        >
          <PlaceIcon sx={{ color: '#92400E', fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: '#92400E', fontWeight: 500, flex: 1 }}>
            Click an empty cell to place{' '}
            <strong>Unit {selectedUnit!.unitNumber}</strong>. Press{' '}
            <Box component="kbd" sx={{ px: 0.75, py: 0.25, bgcolor: '#FCD34D', borderRadius: 0.5, fontSize: '0.75rem' }}>
              Esc
            </Box>{' '}
            to cancel.
          </Typography>
          <IconButton size="small" onClick={() => setSelectedUnit(null)} sx={{ color: '#92400E', p: 0.5 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Paper>
      )}

      {/* ── Main layout: sidebar + grid ── */}
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>

        {/* ── Left sidebar ── */}
        <Card
          sx={{
            width: 240,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #EDE5D8',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Sidebar header */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: '1px solid #EDE5D8',
              bgcolor: '#FAF7F2',
              flexShrink: 0,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1C0F06' }}>
                Unplaced Units
              </Typography>
              <Chip
                label={unplacedOnCurrentFloor.length}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  bgcolor: '#B8914A',
                  color: '#1C0F06',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>
              Click a unit, then click a grid cell to place it.
            </Typography>
          </Box>

          {/* Sidebar list */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {unplacedOnCurrentFloor.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                  All units are placed on this floor.
                </Typography>
              </Box>
            ) : (
              unplacedOnCurrentFloor.map((unit) => (
                <SidebarChip
                  key={unit._id}
                  unit={unit}
                  selected={selectedUnit?._id === unit._id}
                  onClick={() =>
                    setSelectedUnit((prev) => (prev?._id === unit._id ? null : unit))
                  }
                />
              ))
            )}
          </Box>

          {/* Sidebar footer — legend */}
          <Divider />
          <Box sx={{ px: 1.5, py: 1.25, bgcolor: '#FAF7F2', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
              <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Legend
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
              {(Object.entries(STATUS_CONFIG) as [UnitStatus, typeof STATUS_CONFIG[UnitStatus]][]).map(
                ([status, cfg]) => (
                  <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: 0.5,
                        bgcolor: cfg.bg,
                        border: `1.5px solid ${cfg.border}`,
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                      {cfg.label}
                    </Typography>
                  </Box>
                )
              )}
            </Box>
          </Box>
        </Card>

        {/* ── Grid area ── */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {/* Column numbers */}
          <Box
            sx={{
              display: 'flex',
              pl: `${CELL_SIZE}px`,   // offset for row labels
              flexShrink: 0,
              mb: 0.25,
            }}
          >
            {Array.from({ length: GRID_COLS }, (_, c) => (
              <Box
                key={c}
                sx={{
                  width: CELL_SIZE,
                  flexShrink: 0,
                  textAlign: 'center',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontSize: '0.6rem', color: '#9CA3AF', fontWeight: 500 }}
                >
                  {c + 1}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Scrollable grid */}
          <Box
            sx={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'auto',
              border: '1px solid #EDE5D8',
              borderRadius: 2,
              bgcolor: '#FFFFFF',
              cursor: isPlacingMode ? 'crosshair' : 'default',
            }}
          >
            <Box sx={{ display: 'inline-flex', flexDirection: 'column', p: 1 }}>
              {Array.from({ length: GRID_ROWS }, (_, row) => (
                <Box key={row} sx={{ display: 'flex', alignItems: 'center' }}>
                  {/* Row label */}
                  <Box
                    sx={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontSize: '0.6rem', color: '#9CA3AF', fontWeight: 500 }}
                    >
                      {row + 1}
                    </Typography>
                  </Box>

                  {/* Cells */}
                  {Array.from({ length: GRID_COLS }, (_, col) => {
                    const occupant = currentGridMap.get(`${col}:${row}`) ?? null
                    return (
                      <GridCell
                        key={col}
                        col={col}
                        row={row}
                        unit={occupant}
                        isSelectingMode={isPlacingMode}
                        onClick={handleCellClick}
                      />
                    )
                  })}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Grid footer — compass / info bar */}
          <Box
            sx={{
              mt: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Grid: {GRID_COLS} cols &times; {GRID_ROWS} rows &nbsp;&middot;&nbsp;
              {CELL_SIZE}px per cell &nbsp;&middot;&nbsp;
              Click a placed unit to see details or remove it
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Cell popover ── */}
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
        {popoverUnit && positions[popoverUnit._id] && (
          <CellPopover
            unit={popoverUnit}
            position={positions[popoverUnit._id]}
            onRemove={() => handleRemoveFromGrid(popoverUnit)}
            onClose={() => {
              setPopoverUnit(null)
              setPopoverAnchor(null)
            }}
          />
        )}
      </Popover>

      {/* ── Save success snackbar ── */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={3500}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          onClose={() => setSaveSuccess(false)}
          sx={{ borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
        >
          Floor plan saved successfully.
        </Alert>
      </Snackbar>

      {/* ── Save error snackbar ── */}
      <Snackbar
        open={Boolean(saveError)}
        autoHideDuration={5000}
        onClose={() => setSaveError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          onClose={() => setSaveError(null)}
          sx={{ borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
        >
          {saveError}
        </Alert>
      </Snackbar>
    </Box>
  )
}
