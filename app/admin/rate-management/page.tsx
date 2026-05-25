'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import HistoryIcon from '@mui/icons-material/History'
import SettingsIcon from '@mui/icons-material/Settings'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { formatMoney } from '@/lib/utils'

const UNIT_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle / Outdoor',
}

interface UnitTypeSuggestion {
  rule: { id: string; unitType: string; minOccupancyPct: number }
  unitType: string
  currentStreetRate: number
  suggestedStreetRate: number
  increaseAmount: number
  occupancyRate: number
}

interface RentalSuggestion {
  rule: { id: string; unitType: string }
  leaseId: string
  tenantId: string
  unitId: string
  unitType: string
  currentRate: number
  suggestedRate: number
  increaseAmount: number
  monthsSinceLastChange: number
  notificationDate: string
  changeDate: string
  tenantName: string
  tenantEmail: string
  unitNumber: string
}

interface UnitTypeRow extends UnitTypeSuggestion {
  selected: boolean
  newPriceCents: number
  newTargetOccupancyPct: number
}

interface RentalRow extends RentalSuggestion {
  selected: boolean
  newRateCents: number
  notificationDate: string
  changeDate: string
}

export default function RateManagementSummaryPage() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [unitTypeRows, setUnitTypeRows] = useState<UnitTypeRow[]>([])
  const [rentalRows, setRentalRows] = useState<RentalRow[]>([])
  const [channels, setChannels] = useState({ email: true, text: false, print: false })
  const [submitting, setSubmitting] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/rate-management/suggestions')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load')
      setEnabled(!!json.data.enabled)
      setUnitTypeRows((json.data.unitTypeSuggestions ?? []).map((s: UnitTypeSuggestion) => ({
        ...s,
        selected: true,
        newPriceCents: s.suggestedStreetRate,
        newTargetOccupancyPct: s.rule.minOccupancyPct,
      })))
      setRentalRows((json.data.rentalSuggestions ?? []).map((s: RentalSuggestion) => ({
        ...s,
        selected: true,
        newRateCents: s.suggestedRate,
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalSelected =
    unitTypeRows.filter((r) => r.selected).length +
    rentalRows.filter((r) => r.selected).length

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const selectedChannels = Object.entries(channels)
        .filter(([, on]) => on)
        .map(([k]) => k)
      const res = await fetch('/api/admin/rate-management/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifChannels: selectedChannels,
          unitTypeChanges: unitTypeRows.filter((r) => r.selected).map((r) => ({
            unitType: r.unitType,
            newPrice: r.newPriceCents,
            newTargetOccupancyPct: r.newTargetOccupancyPct !== r.rule.minOccupancyPct ? r.newTargetOccupancyPct : undefined,
          })),
          rentalChanges: rentalRows.filter((r) => r.selected).map((r) => ({
            leaseId: r.leaseId,
            unitId: r.unitId,
            tenantId: r.tenantId,
            currentRate: r.currentRate,
            proposedRate: r.newRateCents,
            notificationDate: r.notificationDate,
            changeDate: r.changeDate,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Submit failed')
      setSavedOpen(true)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  if (!enabled) {
    return (
      <Box>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Rate Management is disabled. Enable it under
          {' '}<Link href="/admin/settings/rate-management" style={{ color: '#B8914A' }}>Setup → Rate Management</Link>.
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 700, color: '#2C3826', flex: 1 }}>
          Rate Management
        </Typography>
        <Button component={Link} href="/admin/rate-management/mass-edit"
          size="small"
          sx={{ textTransform: 'none', color: '#5C5347' }}>
          Mass Edit
        </Button>
        <Button component={Link} href="/admin/rate-management/batches"
          size="small" startIcon={<HistoryIcon />}
          sx={{ textTransform: 'none', color: '#5C5347' }}>
          Batches
        </Button>
        <Button component={Link} href="/admin/settings/rate-management"
          size="small" startIcon={<SettingsIcon />}
          sx={{ textTransform: 'none', color: '#5C5347' }}>
          Settings
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        Review the suggested changes. Uncheck a row to skip it (it will reappear on the next visit).
      </Alert>

      {/* Unit Type Price Changes */}
      <Card sx={{ border: '1px solid #E5E7EB', boxShadow: 'none', borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TrendingUpIcon sx={{ color: '#B8914A' }} />
            <Typography variant="subtitle1" fontWeight={700}>Unit Type Price Changes (Street Rate)</Typography>
            <Chip size="small" label={unitTypeRows.length} sx={{ ml: 1 }} />
          </Box>

          {unitTypeRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No unit types currently match a Unit Type Price rule.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Unit Type</TableCell>
                    <TableCell align="right">Occupancy</TableCell>
                    <TableCell align="right">Current Street Rate</TableCell>
                    <TableCell align="right">New Price</TableCell>
                    <TableCell align="right">New Target Occupancy %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unitTypeRows.map((r) => (
                    <TableRow key={r.rule.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox checked={r.selected} onChange={(e) =>
                          setUnitTypeRows((rs) => rs.map((x) => x.rule.id === r.rule.id ? { ...x, selected: e.target.checked } : x))} />
                      </TableCell>
                      <TableCell>{UNIT_TYPE_LABELS[r.unitType] ?? r.unitType}</TableCell>
                      <TableCell align="right">{r.occupancyRate.toFixed(1)}%</TableCell>
                      <TableCell align="right">{formatMoney(r.currentStreetRate)}</TableCell>
                      <TableCell align="right">
                        <TextField size="small" type="number"
                          value={(r.newPriceCents / 100).toFixed(2)}
                          onChange={(e) =>
                            setUnitTypeRows((rs) => rs.map((x) => x.rule.id === r.rule.id
                              ? { ...x, newPriceCents: Math.round((parseFloat(e.target.value) || 0) * 100) }
                              : x))}
                          sx={{ width: 100 }} />
                      </TableCell>
                      <TableCell align="right">
                        <TextField size="small" type="number"
                          value={r.newTargetOccupancyPct}
                          onChange={(e) =>
                            setUnitTypeRows((rs) => rs.map((x) => x.rule.id === r.rule.id
                              ? { ...x, newTargetOccupancyPct: parseFloat(e.target.value) || 0 }
                              : x))}
                          inputProps={{ min: 0, max: 100 }}
                          sx={{ width: 80 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Rental Price Changes */}
      <Card sx={{ border: '1px solid #E5E7EB', boxShadow: 'none', borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TrendingUpIcon sx={{ color: '#B8914A' }} />
            <Typography variant="subtitle1" fontWeight={700}>Rental Price Changes (Existing tenants)</Typography>
            <Chip size="small" label={rentalRows.length} sx={{ ml: 1 }} />
          </Box>

          {rentalRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No rentals currently match a Rental Price rule.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Tenant</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell align="right">Months Since</TableCell>
                    <TableCell align="right">Current Rate</TableCell>
                    <TableCell align="right">New Rate</TableCell>
                    <TableCell>Notification</TableCell>
                    <TableCell>Change</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rentalRows.map((r) => (
                    <TableRow key={r.leaseId} hover>
                      <TableCell padding="checkbox">
                        <Checkbox checked={r.selected} onChange={(e) =>
                          setRentalRows((rs) => rs.map((x) => x.leaseId === r.leaseId ? { ...x, selected: e.target.checked } : x))} />
                      </TableCell>
                      <TableCell>
                        <div>{r.tenantName}</div>
                        <Typography variant="caption" color="text.secondary">{r.tenantEmail}</Typography>
                      </TableCell>
                      <TableCell>{r.unitNumber}</TableCell>
                      <TableCell align="right">{r.monthsSinceLastChange}</TableCell>
                      <TableCell align="right">{formatMoney(r.currentRate)}</TableCell>
                      <TableCell align="right">
                        <TextField size="small" type="number"
                          value={(r.newRateCents / 100).toFixed(2)}
                          onChange={(e) =>
                            setRentalRows((rs) => rs.map((x) => x.leaseId === r.leaseId
                              ? { ...x, newRateCents: Math.round((parseFloat(e.target.value) || 0) * 100) }
                              : x))}
                          sx={{ width: 100 }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="date"
                          value={r.notificationDate.slice(0, 10)}
                          onChange={(e) =>
                            setRentalRows((rs) => rs.map((x) => x.leaseId === r.leaseId
                              ? { ...x, notificationDate: new Date(e.target.value).toISOString() }
                              : x))}
                          sx={{ width: 140 }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="date"
                          value={r.changeDate.slice(0, 10)}
                          onChange={(e) =>
                            setRentalRows((rs) => rs.map((x) => x.leaseId === r.leaseId
                              ? { ...x, changeDate: new Date(e.target.value).toISOString() }
                              : x))}
                          sx={{ width: 140 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <Card sx={{ border: '1px solid #E5E7EB', boxShadow: 'none', borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" fontWeight={700}>Notifications</Typography>
          <FormControlLabel control={<Checkbox checked={channels.email} onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))} />} label="Email" />
          <FormControlLabel control={<Checkbox checked={channels.text} onChange={(e) => setChannels((c) => ({ ...c, text: e.target.checked }))} />} label="Text" />
          <FormControlLabel control={<Checkbox checked={channels.print} onChange={(e) => setChannels((c) => ({ ...c, print: e.target.checked }))} />} label="Print" />
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || totalSelected === 0}
            sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600, px: 3 }}
          >
            {submitting ? <CircularProgress size={20} sx={{ color: 'white' }} /> : `Submit ${totalSelected} change(s)`}
          </Button>
        </CardContent>
      </Card>

      <Snackbar open={savedOpen} autoHideDuration={2500} onClose={() => setSavedOpen(false)} message="Changes submitted" />
    </Box>
  )
}
