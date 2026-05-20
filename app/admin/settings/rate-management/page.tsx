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
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

type UnitType = 'standard' | 'climate_controlled' | 'drive_up' | 'vehicle_outdoor'
const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle / Outdoor',
}

interface UnitTypeRule {
  id: string
  unitType: string
  increaseAmount?: number   // cents
  increasePercent?: number
  minOccupancyPct: number
  roundingRule: 'none' | 'nearest_dollar'
}

interface RentalRule {
  id: string
  unitType: string
  increaseAmount?: number
  increasePercent?: number
  minMonthsSinceLastChange: number
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: '#EDE5D8' },
    '&:hover fieldset': { borderColor: '#B8914A' },
    '&.Mui-focused fieldset': { borderColor: '#B8914A' },
  },
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

export default function RateManagementSettingsPage() {
  const [enabled, setEnabled] = useState(false)
  const [reminderDay, setReminderDay] = useState(1)
  const [advanceNoticeDays, setAdvanceNoticeDays] = useState(30)
  const [allowExceeding, setAllowExceeding] = useState(false)
  const [roundToDollar, setRoundToDollar] = useState(true)
  const [unitTypeRules, setUnitTypeRules] = useState<UnitTypeRule[]>([])
  const [rentalRules, setRentalRules] = useState<RentalRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        setEnabled(!!d.rateManagementEnabled)
        setReminderDay(d.rateManagementReminderDay ?? 1)
        setAdvanceNoticeDays(d.rentalPriceAdvanceNoticeDays ?? 30)
        setAllowExceeding(!!d.rentalPriceAllowExceedingStreetRate)
        setRoundToDollar(d.rentalPriceRoundToNearestDollar !== false)
        setUnitTypeRules(d.unitTypePriceRules ?? [])
        setRentalRules(d.rentalPriceRules ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = useCallback(async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rateManagementEnabled: enabled,
          rateManagementReminderDay: reminderDay,
          rentalPriceAdvanceNoticeDays: advanceNoticeDays,
          rentalPriceAllowExceedingStreetRate: allowExceeding,
          rentalPriceRoundToNearestDollar: roundToDollar,
          unitTypePriceRules: unitTypeRules,
          rentalPriceRules: rentalRules,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Save failed')
      setSavedOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaving(false) }
  }, [enabled, reminderDay, advanceNoticeDays, allowExceeding, roundToDollar, unitTypeRules, rentalRules])

  function addUnitTypeRule() {
    setUnitTypeRules((rs) => [...rs, {
      id: newId('utr'),
      unitType: 'standard',
      increasePercent: 5,
      minOccupancyPct: 90,
      roundingRule: 'nearest_dollar',
    }])
  }

  function addRentalRule() {
    setRentalRules((rs) => [...rs, {
      id: newId('rpr'),
      unitType: 'standard',
      increasePercent: 5,
      minMonthsSinceLastChange: 12,
    }])
  }

  function updateUnitTypeRule(id: string, patch: Partial<UnitTypeRule>) {
    setUnitTypeRules((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r))
  }

  function updateRentalRule(id: string, patch: Partial<RentalRule>) {
    setRentalRules((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r))
  }

  function removeUnitTypeRule(id: string) {
    setUnitTypeRules((rs) => rs.filter((r) => r.id !== id))
  }

  function removeRentalRule(id: string) {
    setRentalRules((rs) => rs.filter((r) => r.id !== id))
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: 300, alignItems: 'center' }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  // Unit types already covered by a rule — used to grey them out in dropdowns
  // since Storable allows at most one rule per type per rule-set.
  const utUsed = new Set(unitTypeRules.map((r) => r.unitType))
  const rpUsed = new Set(rentalRules.map((r) => r.unitType))

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button component={Link} href="/admin/settings" startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}>
          Setup
        </Button>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06', flex: 1 }}>
          Rate Management
        </Typography>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600, px: 2.5 }}
        >
          {saving ? 'Saving…' : 'Update Settings'}
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        Rate Management <strong>suggests</strong> price changes — it never applies them automatically.
        Submit suggestions from the <Link href="/admin/rate-management" style={{ color: '#B8914A' }}>Summary page</Link>.
      </Alert>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* Enable + reminder */}
      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                sx={{ '& .Mui-checked': { color: '#B8914A' }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: '#B8914A' } }}
              />
            }
            label={<Typography fontWeight={600}>Enable Rate Management</Typography>}
          />
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">Reminder Day of the Month</Typography>
            <TextField
              type="number" size="small"
              value={reminderDay}
              onChange={(e) => setReminderDay(Math.min(28, Math.max(1, parseInt(e.target.value || '1', 10))))}
              inputProps={{ min: 1, max: 28 }}
              sx={{ width: 80, ...inputSx }}
              disabled={!enabled}
            />
            <Typography variant="caption" color="text.secondary">Optional email to notifications email.</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Unit Type Price Change Rules */}
      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>Unit Type Price Change Rules (Street rates)</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addUnitTypeRule}
              sx={{ textTransform: 'none', color: '#B8914A', fontWeight: 600 }}>
              Add Rule
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Triggered when a unit type&apos;s occupancy meets/exceeds the threshold. One rule per unit type.
          </Typography>

          {unitTypeRules.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No rules configured.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Unit Type</TableCell>
                    <TableCell>Increase</TableCell>
                    <TableCell>When Occupancy ≥</TableCell>
                    <TableCell>Rounding</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unitTypeRules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Select size="small" value={r.unitType}
                          onChange={(e) => updateUnitTypeRule(r.id, { unitType: e.target.value })}
                          sx={inputSx}>
                          {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => (
                            <MenuItem key={t} value={t} disabled={utUsed.has(t) && t !== r.unitType}>
                              {UNIT_TYPE_LABELS[t]}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Select size="small"
                            value={r.increasePercent !== undefined ? 'percent' : 'amount'}
                            onChange={(e) => {
                              if (e.target.value === 'percent') updateUnitTypeRule(r.id, { increasePercent: 5, increaseAmount: undefined })
                              else updateUnitTypeRule(r.id, { increaseAmount: 500, increasePercent: undefined })
                            }}
                            sx={inputSx}>
                            <MenuItem value="amount">$ Amount</MenuItem>
                            <MenuItem value="percent">% Percent</MenuItem>
                          </Select>
                          <TextField
                            type="number" size="small"
                            value={r.increasePercent !== undefined ? r.increasePercent : ((r.increaseAmount ?? 0) / 100)}
                            onChange={(e) => {
                              const n = parseFloat(e.target.value) || 0
                              if (r.increasePercent !== undefined) updateUnitTypeRule(r.id, { increasePercent: n })
                              else updateUnitTypeRule(r.id, { increaseAmount: Math.round(n * 100) })
                            }}
                            sx={{ width: 90, ...inputSx }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <TextField type="number" size="small"
                          value={r.minOccupancyPct}
                          onChange={(e) => updateUnitTypeRule(r.id, { minOccupancyPct: parseFloat(e.target.value) || 0 })}
                          InputProps={{ endAdornment: '%' }}
                          sx={{ width: 90, ...inputSx }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select size="small" value={r.roundingRule}
                          onChange={(e) => updateUnitTypeRule(r.id, { roundingRule: e.target.value as 'none' | 'nearest_dollar' })}
                          sx={inputSx}>
                          <MenuItem value="none">None</MenuItem>
                          <MenuItem value="nearest_dollar">Nearest $</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => removeUnitTypeRule(r.id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Rental Price Change Rules */}
      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>Rental Price Change Rules (Existing tenants)</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addRentalRule}
              sx={{ textTransform: 'none', color: '#B8914A', fontWeight: 600 }}>
              Add Rule
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Triggered by months since the rental&apos;s last rate change.
          </Typography>

          {/* Global rental options */}
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">Advance Notice (days)</Typography>
              <TextField type="number" size="small"
                value={advanceNoticeDays}
                onChange={(e) => setAdvanceNoticeDays(parseInt(e.target.value || '0', 10))}
                inputProps={{ min: 0, max: 365 }}
                sx={{ width: 80, ...inputSx }}
              />
            </Box>
            <FormControlLabel
              control={<Checkbox checked={allowExceeding} onChange={(e) => setAllowExceeding(e.target.checked)} sx={{ '&.Mui-checked': { color: '#B8914A' } }} />}
              label="Allow exceeding street rate"
            />
            <FormControlLabel
              control={<Checkbox checked={roundToDollar} onChange={(e) => setRoundToDollar(e.target.checked)} sx={{ '&.Mui-checked': { color: '#B8914A' } }} />}
              label="Round to nearest $"
            />
          </Box>
          <Divider sx={{ mb: 2 }} />

          {rentalRules.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No rules configured.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Unit Type</TableCell>
                    <TableCell>Increase</TableCell>
                    <TableCell>When months since last change ≥</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rentalRules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Select size="small" value={r.unitType}
                          onChange={(e) => updateRentalRule(r.id, { unitType: e.target.value })}
                          sx={inputSx}>
                          {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => (
                            <MenuItem key={t} value={t} disabled={rpUsed.has(t) && t !== r.unitType}>
                              {UNIT_TYPE_LABELS[t]}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Select size="small"
                            value={r.increasePercent !== undefined ? 'percent' : 'amount'}
                            onChange={(e) => {
                              if (e.target.value === 'percent') updateRentalRule(r.id, { increasePercent: 5, increaseAmount: undefined })
                              else updateRentalRule(r.id, { increaseAmount: 500, increasePercent: undefined })
                            }}
                            sx={inputSx}>
                            <MenuItem value="amount">$ Amount</MenuItem>
                            <MenuItem value="percent">% Percent</MenuItem>
                          </Select>
                          <TextField
                            type="number" size="small"
                            value={r.increasePercent !== undefined ? r.increasePercent : ((r.increaseAmount ?? 0) / 100)}
                            onChange={(e) => {
                              const n = parseFloat(e.target.value) || 0
                              if (r.increasePercent !== undefined) updateRentalRule(r.id, { increasePercent: n })
                              else updateRentalRule(r.id, { increaseAmount: Math.round(n * 100) })
                            }}
                            sx={{ width: 90, ...inputSx }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <TextField type="number" size="small"
                          value={r.minMonthsSinceLastChange}
                          onChange={(e) => updateRentalRule(r.id, { minMonthsSinceLastChange: parseInt(e.target.value || '0', 10) })}
                          inputProps={{ min: 0, max: 120 }}
                          sx={{ width: 90, ...inputSx }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => removeRentalRule(r.id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={savedOpen}
        autoHideDuration={2500}
        onClose={() => setSavedOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message="Settings saved"
      />
    </Box>
  )
}
