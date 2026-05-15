'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { formatMoney, formatDate } from '@/lib/utils'
import {
  DISPLAY_STATUS_COLORS,
  DISPLAY_STATUS_LABELS,
  type UnitDisplayStatus,
} from '@/lib/unitStatus'
import type { UnitStatus, UnitType, TenantStatus } from '@/types'

interface PopulatedTenant {
  _id: string
  firstName: string
  lastName: string
  status: TenantStatus
  lockedOutAt?: string | null
}

interface PopulatedLease {
  _id: string
  startDate: string
  monthlyRate: number
  billingDay: number
  status: 'active' | 'ended' | 'pending_moveout'
}

interface PopulatedUnit {
  _id: string
  unitNumber: string
  size: string
  type: UnitType
  floor: 'ground' | 'upper'
  price: number
  status: UnitStatus
  displayStatus: UnitDisplayStatus
  features: string[]
  pricingOptions?: Array<{ amount: number; intervalMonths: number }>
  defaultDeposit?: number
  defaultSetupFee?: number
  reservationPrice?: number
  notes?: string
  currentTenantId?: PopulatedTenant | string | null
  currentLeaseId?: PopulatedLease | string | null
  createdAt: string
  updatedAt: string
  createdByName?: string
  updatedByName?: string
  nextBillDate?: string | null
}

function formatDateTime(iso: string): string {
  // 5/26/2022 06:52PM — matches the live audit footer.
  const d = new Date(iso)
  const date = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const meridian = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${date} ${String(h).padStart(2, '0')}:${m}${meridian}`
}

function pricingLabel(opt: { amount: number; intervalMonths: number }): string {
  return `${formatMoney(opt.amount)} / ${opt.intervalMonths} ${opt.intervalMonths === 1 ? 'month' : 'months'}`
}

// Striped two-column row matching the screenshot.
function Row({
  label, value, dark, fullColorBg, fullColorText, valueRed,
}: {
  label: string
  value: React.ReactNode
  dark?: boolean
  fullColorBg?: string
  fullColorText?: string
  valueRed?: boolean
}) {
  const bg = fullColorBg ?? (dark ? '#F3F4F6' : '#FFFFFF')
  const valueColor = fullColorText ?? (valueRed ? '#DC2626' : '#1C0F06')
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        alignItems: 'center',
        bgcolor: bg,
        borderBottom: '1px solid #EDE5D8',
      }}
    >
      <Box sx={{ px: 2.5, py: 1.5, fontWeight: 700, color: dark || fullColorBg ? '#1C0F06' : '#1C0F06', bgcolor: fullColorBg }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: fullColorText ?? '#1C0F06' }}>
          {label}
        </Typography>
      </Box>
      <Box sx={{ px: 2.5, py: 1.5 }}>
        <Typography variant="body2" sx={{ color: valueColor, fontWeight: fullColorText ? 700 : 400 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  )
}

export default function UnitDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const unitId = params.id

  const [unit, setUnit] = useState<PopulatedUnit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Change Status modal
  const [statusOpen, setStatusOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<UnitStatus>('available')
  const [savingStatus, setSavingStatus] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/units/${unitId}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? `Failed to load unit (${res.status})`)
      setUnit(json.data)
      setPendingStatus(json.data.status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load unit')
    } finally {
      setLoading(false)
    }
  }, [unitId])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSaveStatus() {
    if (!unit) return
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/units/${unit._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pendingStatus }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? 'Failed to update status')
        return
      }
      setStatusOpen(false)
      fetchData()
    } finally {
      setSavingStatus(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !unit) {
    return (
      <Box>
        <Button component={Link} href="/admin/units" startIcon={<ArrowBackIcon />} sx={{ color: 'text.secondary', mb: 2 }}>
          Units
        </Button>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchData}>Retry</Button>}>
          {error ?? 'Unit not found'}
        </Alert>
      </Box>
    )
  }

  const tenant = unit.currentTenantId && typeof unit.currentTenantId === 'object'
    ? (unit.currentTenantId as PopulatedTenant)
    : null
  const lease = unit.currentLeaseId && typeof unit.currentLeaseId === 'object'
    ? (unit.currentLeaseId as PopulatedLease)
    : null

  const statusC = DISPLAY_STATUS_COLORS[unit.displayStatus]

  // Pricing options fallback: if none configured, derive from price + reservation.
  const pricingOptions: Array<{ amount: number; intervalMonths: number }> =
    unit.pricingOptions && unit.pricingOptions.length > 0
      ? unit.pricingOptions
      : [{ amount: unit.price, intervalMonths: 1 }]

  const reservationPrice = unit.reservationPrice ?? unit.price * 2
  const defaultDeposit = unit.defaultDeposit ?? unit.price
  const defaultSetupFee = unit.defaultSetupFee ?? 0

  const isLocked = tenant?.status === 'locked_out'

  return (
    <Box>
      {/* Header — Back button + title + top-right actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
        <Button
          component={Link}
          href="/admin/units"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Back
        </Button>
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, fontFamily: '"Playfair Display", serif', color: '#1C0F06', flex: 1 }}
        >
          Unit {unit.unitNumber}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => router.push(`/admin/units/${unit._id}/history`)}
          sx={{ textTransform: 'none' }}
        >
          Unit History
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setStatusOpen(true)}
          sx={{ textTransform: 'none' }}
        >
          Change Status
        </Button>
        <Button
          variant="contained"
          size="small"
          disableElevation
          onClick={() => router.push(`/admin/units/${unit._id}/edit`)}
          sx={{ bgcolor: '#8CA87C', '&:hover': { bgcolor: '#7E9770' }, textTransform: 'none' }}
        >
          Edit
        </Button>
      </Box>

      {/* Striped data table — mirrors the Storable layout */}
      <Box sx={{ border: '1px solid #EDE5D8', borderRadius: 1, overflow: 'hidden' }}>
        <Row label="Name or Number" value={unit.unitNumber} />
        <Row label="Size" value={unit.size} dark />
        <Row
          label="Pricing Options"
          value={
            <Box>
              {pricingOptions.map((p, i) => (
                <Typography key={i} variant="body2">{pricingLabel(p)}</Typography>
              ))}
            </Box>
          }
        />
        <Row label="Deposit" value={formatMoney(defaultDeposit)} dark />
        <Row label="Setup Fee" value={formatMoney(defaultSetupFee)} />
        <Row label="Reservation Price" value={formatMoney(reservationPrice)} dark />
        <Row
          label="Status"
          value={DISPLAY_STATUS_LABELS[unit.displayStatus]}
          fullColorBg={statusC.bg}
          fullColorText={statusC.text}
        />
        <Row
          label="Customer Access"
          value={
            isLocked && tenant?.lockedOutAt
              ? `Locked out on ${formatDateTime(tenant.lockedOutAt)}`
              : isLocked
                ? 'Locked out'
                : 'Active'
          }
          valueRed={isLocked}
        />
        {tenant && (
          <Row
            label="Rented to"
            value={
              <>
                <Link href={`/admin/tenants/${tenant._id}`} style={{ color: '#3B82F6', textDecoration: 'none' }}>
                  {tenant.firstName} {tenant.lastName}
                </Link>
                {lease && (
                  <Box component="span" sx={{ color: '#1C0F06' }}>
                    {' '}on {formatDateTime(lease.startDate)}
                  </Box>
                )}
              </>
            }
            dark
          />
        )}
        {lease && (
          <Row
            label="Billing Cycle"
            value={`${formatMoney(lease.monthlyRate)} Each Month`}
          />
        )}
        {unit.nextBillDate && (
          <Row label="Next Bill" value={formatDate(unit.nextBillDate)} dark />
        )}
        {unit.notes && <Row label="Notes" value={unit.notes} />}
        <Row
          label="Created"
          value={`${formatDateTime(unit.createdAt)}${unit.createdByName ? ` by ${unit.createdByName}` : ''}`}
          dark
        />
        <Row
          label="Updated"
          value={`${formatDateTime(unit.updatedAt)}${unit.updatedByName ? ` by ${unit.updatedByName}` : ''}`}
        />
      </Box>

      {/* Change Status dialog */}
      <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Status</DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary' }}>
            Only the persisted Unit status is editable here. Derived states (Auction, Late, Lien, …) update
            automatically from lease and tenant data.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="status-label">Status</InputLabel>
            <Select
              labelId="status-label"
              label="Status"
              value={pendingStatus}
              onChange={(e) => setPendingStatus(e.target.value as UnitStatus)}
            >
              <MenuItem value="available">Available</MenuItem>
              <MenuItem value="occupied">Occupied</MenuItem>
              <MenuItem value="reserved">Reserved</MenuItem>
              <MenuItem value="maintenance">Maintenance (Unavailable)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveStatus}
            disabled={savingStatus}
            sx={{ bgcolor: '#8CA87C', '&:hover': { bgcolor: '#7E9770' }, textTransform: 'none' }}
          >
            {savingStatus ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
