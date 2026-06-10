'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Popover,
  Snackbar,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SearchIcon from '@mui/icons-material/Search'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import OpenWithIcon from '@mui/icons-material/OpenWith'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import { formatMoney } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const CELL_PX = 44      // pixels per grid cell — bigger for readability
const FEET_PER_CELL = 5 // each cell = 5 ft
const GRID_COLS = 80
const GRID_ROWS = 80

const STATUS_CONFIG: Record<
  string,
  { bg: string; border: string; color: string; label: string }
> = {
  available:   { bg: '#D1FAE5', border: '#6EE7B7', color: '#065F46', label: 'Available' },
  occupied:    { bg: '#DBEAFE', border: '#93C5FD', color: '#1E3A5F', label: 'Occupied' },
  maintenance: { bg: '#FEF3C7', border: '#FCD34D', color: '#92400E', label: 'Maintenance' },
  reserved:    { bg: '#EDE9FE', border: '#C4B5FD', color: '#3B0764', label: 'Reserved' },
}

const TYPE_LABELS: Record<string, string> = {
  standard:           'Standard',
  climate_controlled: 'Climate',
  drive_up:           'Drive-Up',
  vehicle_outdoor:    'Vehicle',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface UnitData {
  _id: string
  unitNumber: string
  size: string
  width: number
  depth: number
  type: string
  price: number
  status: string
  features: string[]
  notes?: string
  gridX?: number
  gridY?: number
  gridFloor?: number
}

interface Position {
  gridX: number
  gridY: number
  gridFloor: number
  gridRotation: 0 | 90
}

type PositionMap = Record<string, Position>

// ── Helpers ───────────────────────────────────────────────────────────────────

const rawW = (u: { width: number }) => Math.max(1, Math.round(u.width / FEET_PER_CELL))
const rawD = (u: { depth: number }) => Math.max(1, Math.round(u.depth / FEET_PER_CELL))

/** Effective cells wide accounting for rotation */
function cellsWide(u: { width: number; depth: number }, rotation: 0 | 90 = 0) {
  return rotation === 90 ? rawD(u) : rawW(u)
}
function cellsDeep(u: { width: number; depth: number }, rotation: 0 | 90 = 0) {
  return rotation === 90 ? rawW(u) : rawD(u)
}

/** Returns set of "col:row" keys occupied by a unit at given position */
function occupiedCells(
  u: { width: number; depth: number },
  gridX: number,
  gridY: number,
  rotation: 0 | 90 = 0
): string[] {
  const w = cellsWide(u, rotation)
  const d = cellsDeep(u, rotation)
  const out: string[] = []
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < d; j++) {
      out.push(`${gridX + i}:${gridY + j}`)
    }
  }
  return out
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CanvasPage() {
  const [units, setUnits] = useState<UnitData[]>([])
  const [positions, setPositions] = useState<PositionMap>({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Single-level facility — everything lives on one implicit layer.
  const currentFloor = 1
  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null) // placement mode
  const [placingRotation, setPlacingRotation] = useState<0 | 90>(0)
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)
  const [popoverUnit, setPopoverUnit] = useState<UnitData | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unplaced' | 'placed'>('all')

  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  // ── Initial load ──
  useEffect(() => {
    const ctrl = new AbortController()
    async function load() {
      setLoading(true)
      setFetchError(null)
      try {
        const res = await fetch('/api/units?limit=500', { signal: ctrl.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!json.success) throw new Error(json.error ?? 'Failed to load')
        const items: UnitData[] = json.data.items
        const init: PositionMap = {}
        for (const u of items) {
          if (typeof u.gridX === 'number' && typeof u.gridY === 'number') {
            init[u._id] = {
              gridX: u.gridX,
              gridY: u.gridY,
              gridFloor: u.gridFloor ?? 1,
              gridRotation: (u as any).gridRotation === 90 ? 90 : 0,
            }
          }
        }
        setUnits(items)
        setPositions(init)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setFetchError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => ctrl.abort()
  }, [])

  // ── Esc to cancel, R to rotate ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedUnit(null)
        setPlacingRotation(0)
        setHoverCell(null)
        setPopoverUnit(null)
        setPopoverAnchor(null)
      } else if ((e.key === 'r' || e.key === 'R') && selectedUnit) {
        e.preventDefault()
        setPlacingRotation((r) => (r === 0 ? 90 : 0))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedUnit])

  // ── Occupancy map for current floor (for collision + render) ──
  const occupancyByCell = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    for (const [uid, pos] of Object.entries(positions)) {
      if (pos.gridFloor !== currentFloor) continue
      const u = units.find((x) => x._id === uid)
      if (!u) continue
      for (const cell of occupiedCells(u, pos.gridX, pos.gridY, pos.gridRotation)) {
        map.set(cell, uid)
      }
    }
    return map
  }, [positions, units, currentFloor])

  // ── Placed units on current floor (one entry per unit, not per cell) ──
  const placedOnFloor = useMemo(
    () =>
      units
        .map((u) => {
          const pos = positions[u._id]
          if (!pos || pos.gridFloor !== currentFloor) return null
          return { unit: u, pos }
        })
        .filter((x): x is { unit: UnitData; pos: Position } => Boolean(x)),
    [units, positions, currentFloor]
  )

  // ── Sidebar list ──
  const sidebarUnits = useMemo(() => {
    return units
      .filter((u) => {
        const placed = !!positions[u._id]
        if (filter === 'unplaced' && placed) return false
        if (filter === 'placed' && !placed) return false
        if (search) {
          const q = search.toLowerCase()
          return (
            u.unitNumber.toLowerCase().includes(q) ||
            u.size.toLowerCase().includes(q) ||
            u.type.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, 'en', { numeric: true }))
  }, [units, positions, filter, search])

  // ── Place helpers ──
  function canPlaceAt(unit: UnitData, gridX: number, gridY: number, rotation: 0 | 90): boolean {
    const cells = occupiedCells(unit, gridX, gridY, rotation)
    for (const c of cells) {
      const owner = occupancyByCell.get(c)
      if (owner && owner !== unit._id) return false
    }
    // Boundary
    if (gridX + cellsWide(unit, rotation) > GRID_COLS) return false
    if (gridY + cellsDeep(unit, rotation) > GRID_ROWS) return false
    return true
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!selectedUnit) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left + e.currentTarget.scrollLeft) / CELL_PX)
    const y = Math.floor((e.clientY - rect.top + e.currentTarget.scrollTop) / CELL_PX)
    if (!canPlaceAt(selectedUnit, x, y, placingRotation)) return
    setPositions((prev) => ({
      ...prev,
      [selectedUnit._id]: {
        gridX: x,
        gridY: y,
        gridFloor: currentFloor,
        gridRotation: placingRotation,
      },
    }))
    setSelectedUnit(null)
    setPlacingRotation(0)
    setHoverCell(null)
    setIsDirty(true)
  }

  function handleCanvasMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!selectedUnit) {
      if (hoverCell) setHoverCell(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left + e.currentTarget.scrollLeft) / CELL_PX)
    const y = Math.floor((e.clientY - rect.top + e.currentTarget.scrollTop) / CELL_PX)
    if (!hoverCell || hoverCell.x !== x || hoverCell.y !== y) {
      setHoverCell({ x, y })
    }
  }

  function handlePlacedClick(unit: UnitData, e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation()
    if (selectedUnit) return // placement in progress, ignore
    setPopoverUnit(unit)
    setPopoverAnchor(e.currentTarget)
  }

  function handleRemove(unit: UnitData) {
    setPositions((prev) => {
      const next = { ...prev }
      delete next[unit._id]
      return next
    })
    setPopoverUnit(null)
    setPopoverAnchor(null)
    setIsDirty(true)
  }

  function handleRotatePlaced(unitId: string) {
    setPositions((prev) => {
      const cur = prev[unitId]
      if (!cur) return prev
      const next: 0 | 90 = cur.gridRotation === 0 ? 90 : 0
      return { ...prev, [unitId]: { ...cur, gridRotation: next } }
    })
    setIsDirty(true)
  }

  function handleMovePlaced(unit: UnitData) {
    const cur = positions[unit._id]
    setSelectedUnit(unit)
    setPlacingRotation(cur?.gridRotation ?? 0)
    setPopoverUnit(null)
    setPopoverAnchor(null)
  }

  function handleClearFloor() {
    const placedHere = Object.entries(positions).filter(
      ([, p]) => p.gridFloor === currentFloor
    )
    if (placedHere.length === 0) return
    const ok = window.confirm(
      `Remove all ${placedHere.length} placed unit${placedHere.length === 1 ? '' : 's'} from the map? You can save afterwards to persist.`
    )
    if (!ok) return
    setPositions((prev) => {
      const next = { ...prev }
      for (const [uid] of placedHere) delete next[uid]
      return next
    })
    setSelectedUnit(null)
    setPlacingRotation(0)
    setPopoverUnit(null)
    setPopoverAnchor(null)
    setIsDirty(true)
  }

  async function handleSave() {
    const entries = Object.entries(positions)
    setSaving(true)
    setSaveErr(null)
    try {
      const body = {
        positions: entries.map(([id, p]) => ({
          id,
          gridX: p.gridX,
          gridY: p.gridY,
          gridFloor: p.gridFloor,
          gridRotation: p.gridRotation,
        })),
      }
      const res = await fetch('/api/units/positions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`)
      setSaveOk(true)
      setIsDirty(false)
    } catch (err) {
      setSaveErr((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <CircularProgress sx={{ color: '#8CA87C' }} />
      </Box>
    )
  }

  if (fetchError) {
    return (
      <Alert severity="error" sx={{ mt: 4 }}>
        Failed to load units: {fetchError}
      </Alert>
    )
  }

  const placedCount = Object.values(positions).filter((p) => p.gridFloor === currentFloor).length
  const isPlacing = !!selectedUnit
  const previewValid =
    isPlacing && hoverCell ? canPlaceAt(selectedUnit!, hoverCell.x, hoverCell.y, placingRotation) : false

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 600 }}>
      {/* ── Top bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Canvas Editor
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {placedCount} placed · {units.length} total · 1 cell = {FEET_PER_CELL} ft
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="error"
          startIcon={<ClearAllIcon />}
          onClick={handleClearFloor}
          disabled={placedCount === 0}
          sx={{ fontWeight: 600, ml: { xs: 0, sm: 'auto' } }}
        >
          Clear All
        </Button>

        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !isDirty}
          sx={{
            bgcolor: '#8CA87C',
            color: 'white',
            fontWeight: 700,
            '&:hover': { bgcolor: '#7E9770' },
            '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
          }}
        >
          {saving ? 'Saving…' : 'Save Layout'}
        </Button>
      </Box>

      {/* Placement banner */}
      {isPlacing && (
        <Alert
          severity="info"
          icon={false}
          sx={{
            mb: 1,
            bgcolor: '#FEF3C7',
            color: '#92400E',
            border: '1px solid #FCD34D',
            '& .MuiAlert-message': { flex: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' },
          }}
          action={
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button
                size="small"
                startIcon={<RotateRightIcon fontSize="small" />}
                onClick={() => setPlacingRotation((r) => (r === 0 ? 90 : 0))}
                sx={{
                  color: '#92400E',
                  borderColor: '#92400E',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
                variant="outlined"
              >
                Rotate (R)
              </Button>
              <IconButton size="small" onClick={() => { setSelectedUnit(null); setPlacingRotation(0) }} sx={{ color: '#92400E' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          }
        >
          Placing <strong>Unit {selectedUnit!.unitNumber}</strong> ({selectedUnit!.size},{' '}
          {cellsWide(selectedUnit!, placingRotation)}×{cellsDeep(selectedUnit!, placingRotation)} cells
          {placingRotation === 90 && ' · rotated 90°'}). Click on the canvas to place. Press <kbd>R</kbd> to rotate, <kbd>Esc</kbd> to cancel.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        {/* ── Sidebar ── */}
        <Card
          sx={{
            width: 280,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #E5E7EB',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Sidebar header */}
          <Box sx={{ px: 2, py: 1.5, bgcolor: '#FAFAFA', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Units ({sidebarUnits.length})
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="Search by unit#, size, type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ fontSize: 16, mr: 0.5, color: '#9CA3AF' }} />,
              }}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.85rem' } }}
            />
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5 }}>
              {(['all', 'unplaced', 'placed'] as const).map((f) => (
                <Chip
                  key={f}
                  label={f === 'all' ? 'All' : f === 'unplaced' ? 'Unplaced' : 'Placed'}
                  size="small"
                  onClick={() => setFilter(f)}
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    bgcolor: filter === f ? '#8CA87C' : '#F3F4F6',
                    color: filter === f ? 'white' : '#374151',
                    fontWeight: 600,
                    '&:hover': { bgcolor: filter === f ? '#7E9770' : '#E5E7EB' },
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Sidebar list */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {sidebarUnits.length === 0 ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                No units match your filter.
              </Typography>
            ) : (
              sidebarUnits.map((u) => {
                const sc = STATUS_CONFIG[u.status] ?? STATUS_CONFIG.occupied
                const isPlacedHere = !!positions[u._id]
                const isSelected = selectedUnit?._id === u._id
                return (
                  <Box
                    key={u._id}
                    onClick={() =>
                      setSelectedUnit((prev) => (prev?._id === u._id ? null : u))
                    }
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.25,
                      py: 0.75,
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: isSelected ? '#FEF3C7' : isPlacedHere ? '#F9FAFB' : 'white',
                      border: `2px solid ${
                        isSelected ? '#B8914A' : isPlacedHere ? '#E5E7EB' : sc.border
                      }`,
                      transition: 'all 0.12s',
                      '&:hover': {
                        borderColor: '#8CA87C',
                        bgcolor: isSelected ? '#FEF3C7' : '#F0FDF4',
                      },
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.2 }}>
                        {u.unitNumber} · {u.size}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        {TYPE_LABELS[u.type] ?? u.type} · {formatMoney(u.price)}
                      </Typography>
                    </Box>
                    {isPlacedHere && (
                      <Chip
                        label="Placed"
                        size="small"
                        sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#D1FAE5', color: '#065F46', '& .MuiChip-label': { px: 0.75 } }}
                      />
                    )}
                  </Box>
                )
              })
            )}
          </Box>

          {/* Sidebar footer */}
          <Box sx={{ px: 2, py: 1, bgcolor: '#FAFAFA', borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              Click a unit, then click the canvas to place it.
            </Typography>
          </Box>
        </Card>

        {/* ── Canvas area ── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <Box
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMove}
            onMouseLeave={() => setHoverCell(null)}
            sx={{
              flex: 1,
              overflow: 'auto',
              border: '1px solid #E5E7EB',
              borderRadius: 2,
              bgcolor: 'white',
              position: 'relative',
              cursor: isPlacing ? 'crosshair' : 'default',
            }}
          >
            {/* Grid layer */}
            <Box
              sx={{
                position: 'relative',
                width: GRID_COLS * CELL_PX,
                height: GRID_ROWS * CELL_PX,
                backgroundImage: `linear-gradient(to right, #F3F4F6 1px, transparent 1px), linear-gradient(to bottom, #F3F4F6 1px, transparent 1px)`,
                backgroundSize: `${CELL_PX}px ${CELL_PX}px`,
              }}
            >
              {/* Placed units */}
              {placedOnFloor.map(({ unit, pos }) => {
                const sc = STATUS_CONFIG[unit.status] ?? STATUS_CONFIG.occupied
                const w = cellsWide(unit, pos.gridRotation) * CELL_PX
                const h = cellsDeep(unit, pos.gridRotation) * CELL_PX
                return (
                  <Box
                    key={unit._id}
                    onClick={(e) => handlePlacedClick(unit, e)}
                    sx={{
                      position: 'absolute',
                      left: pos.gridX * CELL_PX,
                      top: pos.gridY * CELL_PX,
                      width: w,
                      height: h,
                      bgcolor: sc.bg,
                      border: `1.5px solid ${sc.border}`,
                      color: sc.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: w >= 80 || h >= 80 ? '0.8rem' : '0.65rem',
                      transition: 'box-shadow 0.12s',
                      '&:hover': {
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        zIndex: 2,
                      },
                    }}
                  >
                    {unit.unitNumber}
                  </Box>
                )
              })}

              {/* Ghost preview during placement */}
              {isPlacing && hoverCell && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: hoverCell.x * CELL_PX,
                    top: hoverCell.y * CELL_PX,
                    width: cellsWide(selectedUnit!, placingRotation) * CELL_PX,
                    height: cellsDeep(selectedUnit!, placingRotation) * CELL_PX,
                    bgcolor: previewValid ? 'rgba(140, 168, 124, 0.3)' : 'rgba(220, 38, 38, 0.2)',
                    border: `2px dashed ${previewValid ? '#8CA87C' : '#DC2626'}`,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: previewValid ? '#065F46' : '#991B1B',
                    zIndex: 1,
                  }}
                >
                  {selectedUnit!.unitNumber}
                </Box>
              )}
            </Box>
          </Box>

          {/* Footer info */}
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Each cell = {FEET_PER_CELL} ft · Units render at proportional size · Click a placed unit for details
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, ml: 'auto', flexWrap: 'wrap' }}>
              {Object.entries(STATUS_CONFIG).map(([k, s]) => (
                <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      bgcolor: s.bg,
                      border: `1px solid ${s.border}`,
                      borderRadius: 0.5,
                    }}
                  />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                    {s.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Popover for placed unit ── */}
      <Popover
        open={Boolean(popoverAnchor && popoverUnit)}
        anchorEl={popoverAnchor}
        onClose={() => {
          setPopoverUnit(null)
          setPopoverAnchor(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {popoverUnit && positions[popoverUnit._id] && (
          <Box sx={{ width: 260, p: 0 }}>
            <Box sx={{ px: 2, py: 1.5, bgcolor: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Unit {popoverUnit.unitNumber}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {popoverUnit.size} · {TYPE_LABELS[popoverUnit.type]} · {formatMoney(popoverUnit.price)}/mo
              </Typography>
            </Box>
            <Box sx={{ px: 2, py: 1.5 }}>
              {[
                { label: 'Status', value: STATUS_CONFIG[popoverUnit.status]?.label ?? popoverUnit.status },
                { label: 'Position', value: `Col ${positions[popoverUnit._id].gridX + 1}, Row ${positions[popoverUnit._id].gridY + 1}` },
                {
                  label: 'Cells',
                  value: `${cellsWide(popoverUnit, positions[popoverUnit._id].gridRotation)} × ${cellsDeep(popoverUnit, positions[popoverUnit._id].gridRotation)}`,
                },
                { label: 'Rotation', value: `${positions[popoverUnit._id].gridRotation}°` },
              ].map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>{value}</Typography>
                </Box>
              ))}
            </Box>
            <Divider />
            <Box sx={{ px: 2, py: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenWithIcon fontSize="small" />}
                onClick={() => handleMovePlaced(popoverUnit)}
                sx={{ fontSize: '0.75rem', flex: '1 1 calc(50% - 4px)', borderColor: '#8CA87C', color: '#5B7A4D' }}
              >
                Move
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RotateRightIcon fontSize="small" />}
                onClick={() => handleRotatePlaced(popoverUnit._id)}
                sx={{ fontSize: '0.75rem', flex: '1 1 calc(50% - 4px)', borderColor: '#8CA87C', color: '#5B7A4D' }}
              >
                Rotate
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon fontSize="small" />}
                onClick={() => handleRemove(popoverUnit)}
                sx={{ fontSize: '0.75rem', flex: '1 1 calc(50% - 4px)' }}
              >
                Remove
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNewIcon fontSize="small" />}
                component={Link}
                href={`/admin/units/${popoverUnit._id}`}
                sx={{ fontSize: '0.75rem', flex: '1 1 calc(50% - 4px)' }}
              >
                Details
              </Button>
            </Box>
          </Box>
        )}
      </Popover>

      {/* Save snackbars */}
      <Snackbar open={saveOk} autoHideDuration={3000} onClose={() => setSaveOk(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setSaveOk(false)}>
          Layout saved.
        </Alert>
      </Snackbar>
      <Snackbar open={Boolean(saveErr)} autoHideDuration={5000} onClose={() => setSaveErr(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setSaveErr(null)}>
          {saveErr}
        </Alert>
      </Snackbar>
    </Box>
  )
}
