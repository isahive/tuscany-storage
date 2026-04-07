'use client'

import { useState, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
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

// ── Mock data ─────────────────────────────────────────────────────────────────

interface UnitData {
  id: string
  unitNumber: string
  size: string
  type: UnitType
  floor: 'ground' | 'upper'
  price: number      // cents
  status: UnitStatus
  features: string[]
  tenantName?: string
  notes?: string
}

const MOCK_UNITS: UnitData[] = [
  { id: '1',  unitNumber: '01A', size: '5x5',   type: 'standard',           floor: 'ground', price: 5500,  status: 'available',   features: ['Ground floor', 'LED lighting'] },
  { id: '2',  unitNumber: '01B', size: '5x5',   type: 'standard',           floor: 'ground', price: 5500,  status: 'occupied',    features: ['Ground floor', 'LED lighting'], tenantName: 'John Doe' },
  { id: '3',  unitNumber: '02A', size: '5x10',  type: 'standard',           floor: 'ground', price: 7500,  status: 'occupied',    features: ['Ground floor'], tenantName: 'Sarah Lee' },
  { id: '4',  unitNumber: '02B', size: '5x10',  type: 'standard',           floor: 'ground', price: 7500,  status: 'available',   features: ['Ground floor'] },
  { id: '5',  unitNumber: '03A', size: '10x10', type: 'standard',           floor: 'ground', price: 10000, status: 'occupied',    features: ['Ground floor', 'Drive-up access'], tenantName: 'Mike Torres' },
  { id: '6',  unitNumber: '03B', size: '10x10', type: 'standard',           floor: 'upper',  price: 9500,  status: 'available',   features: ['Upper floor'] },
  { id: '7',  unitNumber: '04A', size: '10x10', type: 'climate_controlled', floor: 'ground', price: 12500, status: 'occupied',    features: ['Climate controlled', 'Ground floor'], tenantName: 'James Wilson' },
  { id: '8',  unitNumber: '04B', size: '10x10', type: 'climate_controlled', floor: 'ground', price: 12500, status: 'maintenance', features: ['Climate controlled', 'Ground floor'], notes: 'HVAC repair in progress' },
  { id: '9',  unitNumber: '05A', size: '10x15', type: 'climate_controlled', floor: 'ground', price: 15500, status: 'occupied',    features: ['Climate controlled', 'LED lighting'], tenantName: 'Emily Johnson' },
  { id: '10', unitNumber: '05B', size: '10x15', type: 'climate_controlled', floor: 'ground', price: 15500, status: 'available',   features: ['Climate controlled', 'LED lighting'] },
  { id: '11', unitNumber: '06A', size: '10x20', type: 'standard',           floor: 'ground', price: 13000, status: 'occupied',    features: ['Ground floor', 'Drive-up access'], tenantName: 'Lisa Nakamura' },
  { id: '12', unitNumber: '06B', size: '10x20', type: 'standard',           floor: 'ground', price: 13000, status: 'occupied',    features: ['Ground floor', 'Drive-up access'], tenantName: 'Kevin Murphy' },
  { id: '13', unitNumber: '07A', size: '10x20', type: 'drive_up',           floor: 'ground', price: 15000, status: 'available',   features: ['Drive-up access', 'Wide door'] },
  { id: '14', unitNumber: '07B', size: '10x20', type: 'drive_up',           floor: 'ground', price: 15000, status: 'occupied',    features: ['Drive-up access', 'Wide door'], tenantName: 'Sandra Hayes' },
  { id: '15', unitNumber: '07C', size: '10x20', type: 'drive_up',           floor: 'ground', price: 16500, status: 'occupied',    features: ['Drive-up access', 'Extra height'], tenantName: 'Maria Santos' },
  { id: '16', unitNumber: '08A', size: '10x30', type: 'drive_up',           floor: 'ground', price: 20000, status: 'occupied',    features: ['Drive-up access', 'Wide door', 'Extra height'], tenantName: 'Michael Patel' },
  { id: '17', unitNumber: '08B', size: '10x30', type: 'drive_up',           floor: 'ground', price: 20000, status: 'reserved',    features: ['Drive-up access', 'Wide door'] },
  { id: '18', unitNumber: '09A', size: '20x20', type: 'vehicle_outdoor',    floor: 'ground', price: 18000, status: 'available',   features: ['Outdoor', 'Covered parking'] },
  { id: '19', unitNumber: '09B', size: '20x20', type: 'vehicle_outdoor',    floor: 'ground', price: 18000, status: 'occupied',    features: ['Outdoor', 'Covered parking'], tenantName: 'Tom Bradley' },
  { id: '20', unitNumber: '09C', size: '20x40', type: 'vehicle_outdoor',    floor: 'ground', price: 25000, status: 'occupied',    features: ['Outdoor', 'RV storage'], tenantName: 'Amy Grant' },
  { id: '21', unitNumber: '10A', size: '10x10', type: 'standard',           floor: 'upper',  price: 9000,  status: 'available',   features: ['Upper floor'] },
  { id: '22', unitNumber: '10B', size: '10x10', type: 'standard',           floor: 'upper',  price: 9000,  status: 'occupied',    features: ['Upper floor'], tenantName: 'Dan Cruz' },
  { id: '23', unitNumber: '11A', size: '10x15', type: 'standard',           floor: 'upper',  price: 11000, status: 'maintenance', features: ['Upper floor'], notes: 'Door latch replacement' },
  { id: '24', unitNumber: '12A', size: '10x15', type: 'climate_controlled', floor: 'ground', price: 18000, status: 'occupied',    features: ['Climate controlled'], tenantName: 'Robert Chen' },
]

// ── Unit card ─────────────────────────────────────────────────────────────────

function UnitCard({ unit, onClick }: { unit: UnitData; onClick: () => void }) {
  const sc = STATUS_COLORS[unit.status]
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
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        },
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
        <Typography variant="caption" sx={{ color: sc.color, opacity: 0.8 }}>
          {formatMoney(unit.price)}/mo
        </Typography>
      </Box>
    </Box>
  )
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function UnitDetailDrawer({ unit, onClose }: { unit: UnitData | null; onClose: () => void }) {
  if (!unit) return null
  const sc = STATUS_COLORS[unit.status]

  return (
    <Drawer anchor="right" open={!!unit} onClose={onClose} PaperProps={{ sx: { width: 360, p: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Unit {unit.unitNumber}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Chip
        label={STATUS_LABELS[unit.status]}
        size="small"
        sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, mb: 2, borderRadius: 1 }}
      />

      <Divider sx={{ mb: 2 }} />

      {[
        { label: 'Size',           value: unit.size },
        { label: 'Type',           value: TYPE_LABELS[unit.type] },
        { label: 'Floor',          value: unit.floor === 'ground' ? 'Ground Floor' : 'Upper Floor' },
        { label: 'Monthly Rate',   value: formatMoney(unit.price) },
        { label: 'Current Tenant', value: unit.tenantName ?? '—' },
      ].map(({ label, value }) => (
        <Box key={label} sx={{ display: 'flex', py: 0.75 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', width: 140, flexShrink: 0 }}>
            {label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {value}
          </Typography>
        </Box>
      ))}

      {unit.features.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Features
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {unit.features.map((f) => (
              <Chip
                key={f}
                label={f}
                size="small"
                variant="outlined"
                sx={{ borderRadius: 1, fontSize: '0.7rem' }}
              />
            ))}
          </Box>
        </>
      )}

      {unit.notes && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            Notes
          </Typography>
          <Typography variant="body2" sx={{ color: '#92400E' }}>
            {unit.notes}
          </Typography>
        </>
      )}
    </Drawer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type StatusFilter = UnitStatus | 'all'
type TypeFilter = UnitType | 'all'

export default function UnitsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null)

  const allSizes = [...new Set(MOCK_UNITS.map((u) => u.size))].sort()

  const filtered = useMemo(() => {
    return MOCK_UNITS.filter((u) => {
      const matchStatus = statusFilter === 'all' || u.status === statusFilter
      const matchType   = typeFilter === 'all'   || u.type === typeFilter
      const matchSize   = sizeFilter === 'all'   || u.size === sizeFilter
      return matchStatus && matchType && matchSize
    })
  }, [statusFilter, typeFilter, sizeFilter])

  // Summary counts
  const counts = MOCK_UNITS.reduce<Record<UnitStatus, number>>(
    (acc, u) => { acc[u.status]++; return acc },
    { available: 0, occupied: 0, maintenance: 0, reserved: 0 },
  )

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Units
      </Typography>

      {/* Legend / summary */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        {(Object.keys(STATUS_COLORS) as UnitStatus[]).map((s) => {
          const sc = STATUS_COLORS[s]
          return (
            <Box
              key={s}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 1,
                bgcolor: sc.bg,
                border: `1px solid ${sc.border}`,
              }}
            >
              <Typography variant="body2" sx={{ color: sc.color, fontWeight: 600 }}>
                {STATUS_LABELS[s]}
              </Typography>
              <Typography variant="body2" sx={{ color: sc.color, opacity: 0.8 }}>
                {counts[s]}
              </Typography>
            </Box>
          )
        })}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {MOCK_UNITS.length} total units
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="available">Available</MenuItem>
                <MenuItem value="occupied">Occupied</MenuItem>
                <MenuItem value="maintenance">Maintenance</MenuItem>
                <MenuItem value="reserved">Reserved</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              >
                <MenuItem value="all">All types</MenuItem>
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="climate_controlled">Climate Controlled</MenuItem>
                <MenuItem value="drive_up">Drive-Up</MenuItem>
                <MenuItem value="vehicle_outdoor">Vehicle / Outdoor</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Size</InputLabel>
              <Select
                label="Size"
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
              >
                <MenuItem value="all">All sizes</MenuItem>
                {allSizes.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="body2" sx={{ color: 'text.secondary', alignSelf: 'center', ml: 'auto' }}>
              {filtered.length} unit{filtered.length !== 1 ? 's' : ''} shown
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Unit grid */}
      <Grid container spacing={1.5}>
        {filtered.map((unit) => (
          <Grid item key={unit.id} xs={6} sm={4} md={3} lg={2}>
            <Tooltip
              title={
                unit.tenantName
                  ? `${unit.tenantName} · ${formatMoney(unit.price)}/mo`
                  : `${STATUS_LABELS[unit.status]} · ${formatMoney(unit.price)}/mo`
              }
              arrow
              placement="top"
            >
              <Box>
                <UnitCard unit={unit} onClick={() => setSelectedUnit(unit)} />
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

      <UnitDetailDrawer unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
    </Box>
  )
}
