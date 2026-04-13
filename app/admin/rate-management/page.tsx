'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { formatMoney, formatDate } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface RateChangeUnit {
  unitNumber: string
  size: string
  tenantName: string
  tenantSince: string
  monthsWithoutIncrease: number
  currentRate: number   // cents
  proposedRate: number  // cents
}

type BatchStatus = 'pending' | 'approved' | 'rejected'

interface RateIncreaseBatch {
  id: string
  name: string
  unitType: string
  occupancyRate: number
  effectiveDate: string
  noticeDate: string
  createdAt: string
  status: BatchStatus
  units: RateChangeUnit[]
}

// ── Unit type display labels ─────────────────────────────────────────────────

const UNIT_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle / Outdoor',
}

// ── Batch generation from real data ──────────────────────────────────────────

interface LeaseItem {
  _id: string
  tenantId: string
  unitId: { _id: string; unitNumber: string; size: string }
  startDate: string
  monthlyRate: number
  status: string
  lastRateChangeDate?: string
}

interface UnitItem {
  _id: string
  unitNumber: string
  size: string
  type: string
  status: string
}

interface TenantItem {
  _id: string
  firstName: string
  lastName: string
}

function buildBatches(
  leases: LeaseItem[],
  units: UnitItem[],
  tenants: TenantItem[],
): RateIncreaseBatch[] {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  // Effective date: first of next month + 30 days (rounded to month)
  const effectiveDate = new Date(now.getFullYear(), now.getMonth() + 2, 1)
  const effectiveDateStr = effectiveDate.toISOString().slice(0, 10)

  // Notice date: 30 days before effective
  const noticeDate = new Date(effectiveDate)
  noticeDate.setDate(noticeDate.getDate() - 30)
  const noticeDateStr = noticeDate.toISOString().slice(0, 10)

  // Build lookup maps
  const tenantMap = new Map(tenants.map((t) => [t._id, t]))
  const unitMap = new Map(units.map((u) => [u._id, u]))

  // Compute occupancy per unit type
  const typeCounts: Record<string, { total: number; occupied: number }> = {}
  for (const unit of units) {
    if (!typeCounts[unit.type]) {
      typeCounts[unit.type] = { total: 0, occupied: 0 }
    }
    typeCounts[unit.type].total++
    if (unit.status === 'occupied') {
      typeCounts[unit.type].occupied++
    }
  }

  // Filter active leases and group by unit type
  const activeLeases = leases.filter((l) => l.status === 'active')
  const leasesByType: Record<string, LeaseItem[]> = {}

  for (const lease of activeLeases) {
    // The unitId is populated with { _id, unitNumber, size } from the leases API
    const unitIdStr = typeof lease.unitId === 'object' ? lease.unitId._id : lease.unitId
    const unit = unitMap.get(unitIdStr)
    if (!unit) continue

    if (!leasesByType[unit.type]) {
      leasesByType[unit.type] = []
    }
    leasesByType[unit.type].push(lease)
  }

  const batches: RateIncreaseBatch[] = []
  let batchIndex = 0

  for (const [unitType, typeLeases] of Object.entries(leasesByType)) {
    const counts = typeCounts[unitType]
    if (!counts || counts.total === 0) continue

    const occupancyRate = Math.round((counts.occupied / counts.total) * 100)

    // Only create batches for types with >= 90% occupancy
    if (occupancyRate < 90) continue

    // Filter to tenants who haven't had a rate change in 12+ months
    // Use lastRateChangeDate if available, otherwise fall back to startDate
    const eligibleUnits: RateChangeUnit[] = []

    for (const lease of typeLeases) {
      const referenceDate = lease.lastRateChangeDate
        ? new Date(lease.lastRateChangeDate)
        : new Date(lease.startDate)

      const monthsSinceChange =
        (now.getFullYear() - referenceDate.getFullYear()) * 12 +
        (now.getMonth() - referenceDate.getMonth())

      if (monthsSinceChange < 12) continue

      const tenant = tenantMap.get(lease.tenantId)
      const tenantName = tenant
        ? `${tenant.firstName} ${tenant.lastName}`
        : 'Unknown Tenant'

      // 5% increase, rounded to nearest dollar (100 cents)
      const proposedRate = Math.round((lease.monthlyRate * 1.05) / 100) * 100

      const unitIdObj = typeof lease.unitId === 'object' ? lease.unitId : null

      eligibleUnits.push({
        unitNumber: unitIdObj?.unitNumber ?? 'N/A',
        size: unitIdObj?.size ?? 'N/A',
        tenantName,
        tenantSince: lease.startDate.slice(0, 10),
        monthsWithoutIncrease: monthsSinceChange,
        currentRate: lease.monthlyRate,
        proposedRate,
      })
    }

    if (eligibleUnits.length === 0) continue

    batchIndex++
    const label = UNIT_TYPE_LABELS[unitType] ?? unitType
    const quarter = `Q${Math.ceil((effectiveDate.getMonth() + 1) / 3)}`
    const year = effectiveDate.getFullYear()

    batches.push({
      id: `batch-${String(batchIndex).padStart(3, '0')}`,
      name: `${label} ${quarter} ${year}`,
      unitType: label,
      occupancyRate,
      effectiveDate: effectiveDateStr,
      noticeDate: noticeDateStr,
      createdAt: today,
      status: 'pending',
      units: eligibleUnits.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber)),
    })
  }

  return batches.sort((a, b) => a.unitType.localeCompare(b.unitType))
}

// ── Theme tokens ─────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#B8914A',
  secondary: '#1C0F06',
  background: '#FAF7F2',
  border: '#EDE5D8',
} as const

const STATUS_CONFIG: Record<BatchStatus, { label: string; bg: string; color: string }> = {
  pending:  { label: 'Pending Review', bg: '#FEF3C7', color: '#92400E' },
  approved: { label: 'Approved',       bg: '#D1FAE5', color: '#065F46' },
  rejected: { label: 'Rejected',       bg: '#FEE2E2', color: '#991B1B' },
}

// ── Batch card component ─────────────────────────────────────────────────────

function BatchCard({
  batch,
  expanded,
  onToggle,
  onApprove,
  onReject,
}: {
  batch: RateIncreaseBatch
  expanded: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const sc = STATUS_CONFIG[batch.status]
  const totalCurrentRevenue = batch.units.reduce((sum, u) => sum + u.currentRate, 0)
  const totalProposedRevenue = batch.units.reduce((sum, u) => sum + u.proposedRate, 0)
  const totalIncrease = totalProposedRevenue - totalCurrentRevenue
  const avgIncreasePercent = batch.units.length > 0
    ? ((totalProposedRevenue - totalCurrentRevenue) / totalCurrentRevenue) * 100
    : 0

  return (
    <Card
      sx={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 2,
        overflow: 'hidden',
        '&:hover': { borderColor: COLORS.primary },
        transition: 'border-color 0.2s',
      }}
      elevation={0}
    >
      <CardContent sx={{ p: 0 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'rgba(184, 145, 74, 0.04)' },
          }}
          onClick={onToggle}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: `${COLORS.primary}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TrendingUpIcon sx={{ color: COLORS.primary, fontSize: 22 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, color: COLORS.secondary, lineHeight: 1.3 }}
              >
                {batch.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {batch.unitType} &middot; {batch.units.length} unit{batch.units.length !== 1 ? 's' : ''} affected
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <Chip
              label={sc.label}
              size="small"
              sx={{
                bgcolor: sc.bg,
                color: sc.color,
                fontWeight: 600,
                fontSize: '0.75rem',
                borderRadius: 1,
                display: { xs: 'none', sm: 'flex' },
              }}
            />
            <IconButton
              size="small"
              sx={{ color: 'text.secondary' }}
              aria-label={expanded ? 'collapse' : 'expand'}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        {/* Summary row */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: { xs: 2, sm: 4 },
            px: 3,
            pb: 2,
          }}
        >
          <SummaryItem
            label="Occupancy"
            value={`${batch.occupancyRate}%`}
            valueColor={batch.occupancyRate >= 90 ? '#065F46' : 'text.primary'}
          />
          <SummaryItem
            label="Monthly Increase"
            value={`+${formatMoney(totalIncrease)}`}
            valueColor={COLORS.primary}
          />
          <SummaryItem
            label="Avg. Increase"
            value={`${avgIncreasePercent.toFixed(1)}%`}
          />
          <SummaryItem
            label="Effective Date"
            value={formatDate(batch.effectiveDate)}
          />
          <SummaryItem
            label="Notice Date"
            value={formatDate(batch.noticeDate)}
          />
        </Box>

        {/* Mobile status chip */}
        <Box sx={{ px: 3, pb: 1.5, display: { xs: 'block', sm: 'none' } }}>
          <Chip
            label={sc.label}
            size="small"
            sx={{
              bgcolor: sc.bg,
              color: sc.color,
              fontWeight: 600,
              fontSize: '0.75rem',
              borderRadius: 1,
            }}
          />
        </Box>

        {/* Expanded detail */}
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Divider sx={{ borderColor: COLORS.border }} />

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: `${COLORS.background}` }}>
                  <TableCell sx={{ fontWeight: 700, color: COLORS.secondary, fontSize: '0.8rem' }}>
                    Unit
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: COLORS.secondary, fontSize: '0.8rem' }}>
                    Size
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: COLORS.secondary, fontSize: '0.8rem' }}>
                    Tenant
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: 700, color: COLORS.secondary, fontSize: '0.8rem', display: { xs: 'none', md: 'table-cell' } }}
                  >
                    Tenant Since
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: 700, color: COLORS.secondary, fontSize: '0.8rem', display: { xs: 'none', md: 'table-cell' } }}
                  >
                    Months w/o Change
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: COLORS.secondary, fontSize: '0.8rem' }} align="right">
                    Current Rate
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: COLORS.secondary, fontSize: '0.8rem' }} align="right">
                    Proposed Rate
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: COLORS.secondary, fontSize: '0.8rem' }} align="right">
                    Change
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batch.units.map((unit) => {
                  const increase = unit.proposedRate - unit.currentRate
                  const pct = ((increase / unit.currentRate) * 100).toFixed(1)
                  return (
                    <TableRow
                      key={unit.unitNumber}
                      sx={{ '&:last-child td': { borderBottom: 0 } }}
                    >
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {unit.unitNumber}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                        {unit.size}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.85rem' }}>
                        {unit.tenantName}
                      </TableCell>
                      <TableCell
                        sx={{ fontSize: '0.85rem', color: 'text.secondary', display: { xs: 'none', md: 'table-cell' } }}
                      >
                        {formatDate(unit.tenantSince)}
                      </TableCell>
                      <TableCell
                        sx={{ fontSize: '0.85rem', display: { xs: 'none', md: 'table-cell' } }}
                      >
                        <Chip
                          label={`${unit.monthsWithoutIncrease} mo`}
                          size="small"
                          sx={{
                            bgcolor: unit.monthsWithoutIncrease >= 18 ? '#FEF3C7' : '#F3F4F6',
                            color: unit.monthsWithoutIncrease >= 18 ? '#92400E' : 'text.secondary',
                            fontWeight: 500,
                            fontSize: '0.75rem',
                            borderRadius: 1,
                            height: 24,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                        {formatMoney(unit.currentRate)}/mo
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {formatMoney(unit.proposedRate)}/mo
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{
                            color: COLORS.primary,
                            fontWeight: 600,
                            fontSize: '0.85rem',
                          }}
                        >
                          +{formatMoney(increase)} ({pct}%)
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {/* Totals row */}
                <TableRow sx={{ bgcolor: `${COLORS.background}` }}>
                  <TableCell
                    colSpan={5}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: COLORS.secondary,
                      borderBottom: 0,
                      display: { xs: 'none', md: 'table-cell' },
                    }}
                  >
                    Batch Total
                  </TableCell>
                  <TableCell
                    colSpan={3}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: COLORS.secondary,
                      borderBottom: 0,
                      display: { xs: 'table-cell', md: 'none' },
                    }}
                  >
                    Batch Total
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, fontSize: '0.85rem', borderBottom: 0 }}
                  >
                    {formatMoney(totalCurrentRevenue)}/mo
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, fontSize: '0.85rem', borderBottom: 0 }}
                  >
                    {formatMoney(totalProposedRevenue)}/mo
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: COLORS.primary,
                      borderBottom: 0,
                    }}
                  >
                    +{formatMoney(totalIncrease)}/mo
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Action buttons */}
          {batch.status === 'pending' && (
            <>
              <Divider sx={{ borderColor: COLORS.border }} />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 1.5,
                  px: 3,
                  py: 2,
                }}
              >
                <Button
                  variant="outlined"
                  startIcon={<CancelOutlinedIcon />}
                  onClick={onReject}
                  sx={{
                    color: '#991B1B',
                    borderColor: '#FECACA',
                    '&:hover': {
                      borderColor: '#F87171',
                      bgcolor: '#FEF2F2',
                    },
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  Reject Batch
                </Button>
                <Button
                  variant="contained"
                  startIcon={<CheckCircleOutlineIcon />}
                  onClick={onApprove}
                  sx={{
                    bgcolor: '#065F46',
                    '&:hover': { bgcolor: '#047857' },
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  Approve &amp; Send Notices
                </Button>
              </Box>
            </>
          )}
        </Collapse>
      </CardContent>
    </Card>
  )
}

// ── Summary item ─────────────────────────────────────────────────────────────

function SummaryItem({
  label,
  value,
  valueColor = 'text.primary',
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: valueColor, fontSize: '0.9rem' }}>
        {value}
      </Typography>
    </Box>
  )
}

// ── Confirmation dialog ──────────────────────────────────────────────────────

function ConfirmationDialog({
  open,
  action,
  batch,
  onConfirm,
  onCancel,
}: {
  open: boolean
  action: 'approve' | 'reject'
  batch: RateIncreaseBatch | null
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!batch) return null

  const isApprove = action === 'approve'
  const totalIncrease = batch.units.reduce((s, u) => s + (u.proposedRate - u.currentRate), 0)

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, border: `1px solid ${COLORS.border}` },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          color: COLORS.secondary,
          pb: 1,
        }}
      >
        {isApprove ? 'Approve Rate Increase' : 'Reject Rate Increase'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {isApprove ? (
            <>
              You are about to approve the rate increase batch{' '}
              <strong>{batch.name}</strong>. This will:
            </>
          ) : (
            <>
              You are about to reject the rate increase batch{' '}
              <strong>{batch.name}</strong>. This will:
            </>
          )}
        </DialogContentText>

        <Box
          sx={{
            bgcolor: COLORS.background,
            borderRadius: 1.5,
            p: 2,
            mb: 2,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {isApprove ? (
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Send 30-day advance notice to <strong>{batch.units.length}</strong> tenant{batch.units.length !== 1 ? 's' : ''}
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Increase monthly revenue by <strong>{formatMoney(totalIncrease)}</strong>
              </Typography>
              <Typography component="li" variant="body2">
                Effective date: <strong>{formatDate(batch.effectiveDate)}</strong>
              </Typography>
            </Box>
          ) : (
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Cancel all proposed rate changes for <strong>{batch.units.length}</strong> unit{batch.units.length !== 1 ? 's' : ''}
              </Typography>
              <Typography component="li" variant="body2">
                No notices will be sent to tenants
              </Typography>
            </Box>
          )}
        </Box>

        {isApprove && (
          <Alert
            severity="info"
            icon={<AccessTimeIcon fontSize="small" />}
            sx={{ borderRadius: 1.5 }}
          >
            Tenants will receive notice by <strong>{formatDate(batch.noticeDate)}</strong> with
            new rates taking effect on <strong>{formatDate(batch.effectiveDate)}</strong>.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onCancel}
          sx={{ textTransform: 'none', color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            bgcolor: isApprove ? '#065F46' : '#991B1B',
            '&:hover': {
              bgcolor: isApprove ? '#047857' : '#B91C1C',
            },
          }}
        >
          {isApprove ? 'Confirm Approval' : 'Confirm Rejection'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RateManagementPage() {
  const [batches, setBatches] = useState<RateIncreaseBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject'>('approve')
  const [dialogBatch, setDialogBatch] = useState<RateIncreaseBatch | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // ── Fetch real data and build batches ──────────────────────────────────────

  useEffect(() => {
    async function loadData() {
      try {
        const [leasesRes, unitsRes, tenantsRes] = await Promise.all([
          fetch('/api/leases?status=active&limit=100'),
          fetch('/api/units?limit=100'),
          fetch('/api/tenants?limit=100'),
        ])

        if (!leasesRes.ok || !unitsRes.ok || !tenantsRes.ok) {
          throw new Error('Failed to load data')
        }

        const [leasesJson, unitsJson, tenantsJson] = await Promise.all([
          leasesRes.json(),
          unitsRes.json(),
          tenantsRes.json(),
        ])

        if (!leasesJson.success || !unitsJson.success || !tenantsJson.success) {
          throw new Error(
            leasesJson.error || unitsJson.error || tenantsJson.error || 'Failed to load data',
          )
        }

        const generatedBatches = buildBatches(
          leasesJson.data.items,
          unitsJson.data.items,
          tenantsJson.data.items,
        )

        setBatches(generatedBatches)

        // Auto-expand first batch
        if (generatedBatches.length > 0) {
          setExpandedIds(new Set([generatedBatches[0].id]))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rate management data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const openDialog = useCallback((batch: RateIncreaseBatch, action: 'approve' | 'reject') => {
    setDialogBatch(batch)
    setDialogAction(action)
    setDialogOpen(true)
  }, [])

  const handleConfirm = useCallback(() => {
    if (!dialogBatch) return

    const newStatus: BatchStatus = dialogAction === 'approve' ? 'approved' : 'rejected'

    setBatches((prev) =>
      prev.map((b) => (b.id === dialogBatch.id ? { ...b, status: newStatus } : b)),
    )

    setSnackbar({
      open: true,
      message:
        dialogAction === 'approve'
          ? `"${dialogBatch.name}" approved. Notices will be sent by ${formatDate(dialogBatch.noticeDate)}.`
          : `"${dialogBatch.name}" rejected. No changes will be applied.`,
      severity: dialogAction === 'approve' ? 'success' : 'error',
    })

    setDialogOpen(false)
    setDialogBatch(null)
  }, [dialogBatch, dialogAction])

  const handleCancel = useCallback(() => {
    setDialogOpen(false)
    setDialogBatch(null)
  }, [])

  const pendingCount = batches.filter((b) => b.status === 'pending').length
  const totalUnitsAffected = batches
    .filter((b) => b.status === 'pending')
    .reduce((sum, b) => sum + b.units.length, 0)
  const totalMonthlyIncrease = batches
    .filter((b) => b.status === 'pending')
    .reduce(
      (sum, b) => sum + b.units.reduce((s, u) => s + (u.proposedRate - u.currentRate), 0),
      0,
    )

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 2 }}>
        <CircularProgress sx={{ color: COLORS.primary }} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Analyzing leases and occupancy data...
        </Typography>
      </Box>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.secondary, mb: 0.5 }}>
            Rate Management
          </Typography>
        </Box>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
      </Box>
    )
  }

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.secondary, mb: 0.5 }}>
          Rate Management
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Review and approve pending rate increase batches. Increases are triggered when
          occupancy reaches 90% for a unit type and tenants have been without a rate change
          for 12+ months.
        </Typography>
      </Box>

      {/* Overview stats */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <Card
          elevation={0}
          sx={{ border: `1px solid ${COLORS.border}`, borderRadius: 2 }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Pending Batches
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.secondary }}>
              {pendingCount}
            </Typography>
          </CardContent>
        </Card>

        <Card
          elevation={0}
          sx={{ border: `1px solid ${COLORS.border}`, borderRadius: 2 }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Units Affected
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.secondary }}>
              {totalUnitsAffected}
            </Typography>
          </CardContent>
        </Card>

        <Card
          elevation={0}
          sx={{ border: `1px solid ${COLORS.border}`, borderRadius: 2 }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Projected Monthly Increase
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.primary }}>
              +{formatMoney(totalMonthlyIncrease)}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Policy info banner */}
      <Alert
        severity="info"
        icon={<InfoOutlinedIcon />}
        sx={{
          mb: 3,
          borderRadius: 1.5,
          border: `1px solid ${COLORS.border}`,
          bgcolor: COLORS.background,
          '& .MuiAlert-icon': { color: COLORS.primary },
        }}
      >
        <Typography variant="body2">
          <strong>Rate increase policy:</strong> 5% increase (rounded up to nearest dollar)
          when unit type occupancy is 90%+ and tenant has been without a rate change for 12+
          months. 30-day advance notice is required.
        </Typography>
      </Alert>

      {/* Batch cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {batches.map((batch) => (
          <BatchCard
            key={batch.id}
            batch={batch}
            expanded={expandedIds.has(batch.id)}
            onToggle={() => toggleExpand(batch.id)}
            onApprove={() => openDialog(batch, 'approve')}
            onReject={() => openDialog(batch, 'reject')}
          />
        ))}
      </Box>

      {batches.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            No rate increase batches to display. This means either no unit types have 90%+
            occupancy, or all eligible tenants have had a rate change within the last 12 months.
          </Typography>
        </Box>
      )}

      {/* Confirmation dialog */}
      <ConfirmationDialog
        open={dialogOpen}
        action={dialogAction}
        batch={dialogBatch}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* Snackbar feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%', borderRadius: 1.5 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
