'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  DISPLAY_STATUS_COLORS,
  DISPLAY_STATUS_LABELS,
  type UnitDisplayStatus,
} from '@/lib/unitStatus'
import type { UnitType } from '@/types'

// Constants mirrored from /admin/units/site-map (the editor) so the visual
// rendering stays identical. Site View is the read-only counterpart — admin
// clicks a unit and lands on its detail page instead of editing the layout.
const CELL_PX = 44
const GRID_COLS = 80
const GRID_ROWS = 80
const FLOORS = [1, 2]

interface UnitData {
  _id: string
  unitNumber: string
  size: string
  type: UnitType
  width: number
  depth: number
  status: 'available' | 'occupied' | 'maintenance' | 'reserved'
  displayStatus: UnitDisplayStatus
  gridX?: number
  gridY?: number
  gridFloor?: number
  gridRotation?: 0 | 90
  currentTenantId?: { _id: string; firstName: string; lastName: string } | string | null
}

// 1 grid cell = 5 ft; width/depth are stored in feet on the Unit model.
const cellsWide = (u: UnitData, rotation?: 0 | 90) => {
  const w = (rotation ?? u.gridRotation ?? 0) === 90 ? u.depth : u.width
  return Math.max(1, Math.round(w / 5))
}
const cellsDeep = (u: UnitData, rotation?: 0 | 90) => {
  const d = (rotation ?? u.gridRotation ?? 0) === 90 ? u.width : u.depth
  return Math.max(1, Math.round(d / 5))
}

export default function UnitSiteViewPage() {
  const router = useRouter()
  const [units, setUnits] = useState<UnitData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [floor, setFloor] = useState(1)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/units?limit=all')
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setUnits(json.data.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const placedOnFloor = useMemo(
    () => units.filter((u) =>
      typeof u.gridX === 'number'
      && typeof u.gridY === 'number'
      && (u.gridFloor ?? 1) === floor,
    ),
    [units, floor],
  )

  const unplacedCount = useMemo(
    () => units.filter((u) => typeof u.gridX !== 'number' || typeof u.gridY !== 'number').length,
    [units],
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button component={Link} href="/admin/units" startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}>
          Units
        </Button>
        <Typography variant="h5" sx={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 700, color: '#2C3826', flex: 1 }}>
          Site View
        </Typography>
        {unplacedCount > 0 && (
          <Chip
            size="small"
            label={`${unplacedCount} unplaced — edit in Site Map`}
            sx={{ bgcolor: '#FEF3C7', color: '#92400E' }}
          />
        )}
        <Button
          variant="outlined"
          size="small"
          component={Link}
          href="/admin/units/site-map"
          sx={{ borderColor: '#E5E7EB', textTransform: 'none' }}
        >
          Edit Layout
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card sx={{ border: '1px solid #E5E7EB', boxShadow: 'none', borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={floor}
          onChange={(_, v) => setFloor(v)}
          sx={{ borderBottom: '1px solid #E5E7EB', px: 2 }}
        >
          {FLOORS.map((f) => (
            <Tab key={f} label={`Floor ${f}`} value={f} sx={{ textTransform: 'none', fontWeight: 600 }} />
          ))}
        </Tabs>

        {/* Compact legend so admins know which color is what when scanning the map. */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: 2, borderBottom: '1px solid #E5E7EB' }}>
          {(['available', 'rented', 'reserved', 'late', 'locked_out', 'pre_lien', 'lien', 'auction', 'moving_out'] as UnitDisplayStatus[]).map((s) => {
            const c = DISPLAY_STATUS_COLORS[s]
            return (
              <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: c.bg, border: `1px solid ${c.text}`, borderRadius: 0.5 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {DISPLAY_STATUS_LABELS[s]}
                </Typography>
              </Box>
            )
          })}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: '#B8914A' }} />
          </Box>
        ) : placedOnFloor.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No units placed on Floor {floor}. Lay them out in{' '}
              <Link href="/admin/units/site-map" style={{ color: '#B8914A' }}>Site Map</Link>.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <Box
              sx={{
                position: 'relative',
                width: GRID_COLS * CELL_PX,
                height: GRID_ROWS * CELL_PX,
                backgroundImage: `linear-gradient(to right, #F3F4F6 1px, transparent 1px), linear-gradient(to bottom, #F3F4F6 1px, transparent 1px)`,
                backgroundSize: `${CELL_PX}px ${CELL_PX}px`,
              }}
            >
              {placedOnFloor.map((unit) => {
                const c = DISPLAY_STATUS_COLORS[unit.displayStatus] ?? { bg: '#F3F4F6', text: '#374151' }
                const w = cellsWide(unit) * CELL_PX
                const h = cellsDeep(unit) * CELL_PX
                const tenant =
                  unit.currentTenantId && typeof unit.currentTenantId === 'object'
                    ? `${unit.currentTenantId.firstName} ${unit.currentTenantId.lastName}`
                    : null
                return (
                  <Box
                    key={unit._id}
                    title={`Unit ${unit.unitNumber} — ${DISPLAY_STATUS_LABELS[unit.displayStatus]}${tenant ? ` — ${tenant}` : ''}`}
                    onClick={() => router.push(`/admin/units/${unit._id}`)}
                    sx={{
                      position: 'absolute',
                      left: (unit.gridX ?? 0) * CELL_PX,
                      top: (unit.gridY ?? 0) * CELL_PX,
                      width: w,
                      height: h,
                      bgcolor: c.bg,
                      border: `1.5px solid ${c.text}`,
                      color: c.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: w >= 80 || h >= 80 ? '0.8rem' : '0.65rem',
                      transition: 'transform 0.1s, box-shadow 0.12s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                        zIndex: 2,
                      },
                    }}
                  >
                    {unit.unitNumber}
                  </Box>
                )
              })}
            </Box>
          </Box>
        )}
      </Card>
    </Box>
  )
}
