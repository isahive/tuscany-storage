'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Skeleton,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import MapIcon from '@mui/icons-material/Map'
import GridViewIcon from '@mui/icons-material/GridView'
import RefreshIcon from '@mui/icons-material/Refresh'
import { formatMoney } from '@/lib/utils'
import {
  DISPLAY_STATUS_COLORS,
  DISPLAY_STATUS_LABELS,
  type UnitDisplayStatus,
} from '@/lib/unitStatus'
import type { UnitType } from '@/types'

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
  status: 'available' | 'occupied' | 'maintenance' | 'reserved'
  displayStatus: UnitDisplayStatus
  features: string[]
  notes?: string
  currentTenantId?: TenantRef | string | null
}

// Order the legend exactly like the live screenshot.
const LEGEND_ORDER: UnitDisplayStatus[] = [
  'auction',
  'available',
  'late',
  'lien',
  'locked_out',
  'reserved_marketplace',
  'moving_out',
  'pending',
  'pre_lien',
  'rented',
  'reserved',
  'unavailable',
]

// Sort sizes by total square footage so the headers come out 5x10, 10x10, …
function sizeSortKey(size: string): number {
  const m = size.match(/(\d+)\s*x\s*(\d+)/i)
  if (!m) return Number.POSITIVE_INFINITY
  return parseInt(m[1], 10) * parseInt(m[2], 10)
}

// Group label takes vehicle/outdoor units out of the size buckets so they
// match the "Boat, RV, Camper & Trailer - Open Air (10 x 30)" header.
function groupLabel(unit: UnitData): string {
  if (unit.type === 'vehicle_outdoor') {
    return `Boat, RV, Camper & Trailer - Open Air (${unit.size})`
  }
  return unit.size
}

function tenantName(unit: UnitData): string | null {
  if (!unit.currentTenantId || typeof unit.currentTenantId !== 'object') return null
  return `${unit.currentTenantId.firstName} ${unit.currentTenantId.lastName}`
}

function UnitPill({ unit, onClick }: { unit: UnitData; onClick: () => void }) {
  const { bg, text } = DISPLAY_STATUS_COLORS[unit.displayStatus]
  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: bg,
        color: text,
        borderRadius: 1,
        px: 1.25,
        py: 1,
        minWidth: 56,
        textAlign: 'center',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: '0.85rem',
        userSelect: 'none',
        transition: 'transform 0.1s, box-shadow 0.1s',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.18)' },
      }}
    >
      {unit.unitNumber}
    </Box>
  )
}

export default function UnitsPage() {
  const router = useRouter()
  const [units, setUnits] = useState<UnitData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUnits = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/units?limit=all')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load units')
      const items = Array.isArray(json.data) ? json.data : (json.data.items ?? [])
      setUnits(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load units')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUnits() }, [fetchUnits])

  // Group by size header — keep insertion order by sqft, then sort units inside
  // by their number for predictable layout.
  const groups = useMemo(() => {
    const map = new Map<string, UnitData[]>()
    for (const u of units) {
      const key = groupLabel(u)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(u)
    }
    // Standard rooms first (by sqft), then vehicle/outdoor at the end.
    const ordered = [...map.entries()].sort((a, b) => {
      const aVeh = a[0].startsWith('Boat')
      const bVeh = b[0].startsWith('Boat')
      if (aVeh && !bVeh) return 1
      if (!aVeh && bVeh) return -1
      return sizeSortKey(a[0]) - sizeSortKey(b[0])
    })
    for (const [, list] of ordered) {
      list.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }))
    }
    return ordered
  }, [units])

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Typography
          variant="h5"
          sx={{ fontFamily: '"Playfair Display", serif', color: '#1C0F06', fontWeight: 700, flexGrow: 1 }}
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
          startIcon={<GridViewIcon />}
          onClick={() => router.push('/admin/units/canvas')}
          sx={{ bgcolor: '#8CA87C', '&:hover': { bgcolor: '#7E9770' } }}
        >
          Canvas
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => router.push('/admin/units/new')}
        >
          New Unit
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
          {loading ? (
            <CircularProgress size={16} />
          ) : (
            <IconButton size="small" onClick={fetchUnits} title="Refresh">
              <RefreshIcon fontSize="small" />
            </IconButton>
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {units.length} total
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={<Button color="inherit" size="small" onClick={fetchUnits}>Retry</Button>}
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Box>
          {Array.from({ length: 3 }).map((_, i) => (
            <Box key={i} sx={{ mb: 4 }}>
              <Skeleton variant="text" width={120} height={32} sx={{ mb: 1 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Array.from({ length: 16 }).map((__, j) => (
                  <Skeleton key={j} variant="rectangular" width={60} height={40} sx={{ borderRadius: 1 }} />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <>
          {groups.map(([label, list]) => (
            <Box key={label} sx={{ mb: 4 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: '#1C0F06', mb: 1.5 }}
              >
                {label}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {list.map((unit) => {
                  const name = tenantName(unit)
                  const title = name
                    ? `${unit.unitNumber} · ${DISPLAY_STATUS_LABELS[unit.displayStatus]} · ${name}`
                    : `${unit.unitNumber} · ${DISPLAY_STATUS_LABELS[unit.displayStatus]} · ${formatMoney(unit.price)}/mo`
                  return (
                    <Tooltip key={unit._id} title={title} arrow placement="top">
                      <Box>
                        <UnitPill unit={unit} onClick={() => router.push(`/admin/units/${unit._id}`)} />
                      </Box>
                    </Tooltip>
                  )
                })}
              </Box>
            </Box>
          ))}

          {groups.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                No units configured yet.
              </Typography>
            </Box>
          )}

          {/* Legend — mirrors the live "Legend" footer 1:1. */}
          {units.length > 0 && (
            <Box sx={{ mt: 5, pt: 3, borderTop: '1px solid #EDE5D8' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1C0F06', mb: 1.5 }}>
                Legend
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {LEGEND_ORDER.map((s) => {
                  const { bg, text } = DISPLAY_STATUS_COLORS[s]
                  return (
                    <Box
                      key={s}
                      sx={{
                        bgcolor: bg,
                        color: text,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 1,
                        fontSize: '0.78rem',
                        fontWeight: 700,
                      }}
                    >
                      {DISPLAY_STATUS_LABELS[s]}
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}
