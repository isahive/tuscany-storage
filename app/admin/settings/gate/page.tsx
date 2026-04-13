'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import SensorsIcon from '@mui/icons-material/Sensors'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import LockIcon from '@mui/icons-material/Lock'
import KeyIcon from '@mui/icons-material/Key'
import SmsIcon from '@mui/icons-material/Sms'
import GroupIcon from '@mui/icons-material/Group'
import RouterIcon from '@mui/icons-material/Router'

// ── Types ────────────────────────────────────────────────────────────────────

interface GateFormValues {
  gateAutoAssign: boolean
  gateAutoAssignMethod: 'phone_last4' | 'random'
  gateCodeLength: number
  gateAutoLockout: boolean
  gateTextToOpen: boolean
  gateTextToOpenNumber: string
  gateControllerType: string
  gateNodeId: string
  gateApiEndpoint: string
  gateApiKey: string
}

const INITIAL: GateFormValues = {
  gateAutoAssign: true,
  gateAutoAssignMethod: 'phone_last4',
  gateCodeLength: 4,
  gateAutoLockout: true,
  gateTextToOpen: false,
  gateTextToOpenNumber: '',
  gateControllerType: '',
  gateNodeId: '',
  gateApiEndpoint: '',
  gateApiKey: '',
}

// Default gate configuration — will be replaced when gate controller is connected

const DEFAULT_GATES = [
  { id: '1', name: 'Entry Keypad', type: 'entry', status: 'offline' },
  { id: '2', name: 'Exit Keypad', type: 'exit', status: 'offline' },
]

const DEFAULT_GATE_GROUPS = [
  { id: '1', name: 'Managers 24/7', accessStart: '00:00', accessEnd: '23:59', customerCount: 2, unitCount: 0 },
  { id: '2', name: 'Renters', accessStart: '05:00', accessEnd: '22:00', customerCount: 0, unitCount: 0 },
]

// ── Shared input style ───────────────────────────────────────────────────────

const inputSx = { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#EDE5D8' }, '&:hover fieldset': { borderColor: '#B8914A' }, '&.Mui-focused fieldset': { borderColor: '#B8914A' } } }
const switchSx = { '& .MuiSwitch-switchBase.Mui-checked': { color: '#B8914A' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#B8914A' } }

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GateSettingsPage() {
  const [form, setForm] = useState<GateFormValues>(INITIAL)
  const [saved, setSaved] = useState<GateFormValues>(INITIAL)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const d = json.data
          const vals: GateFormValues = {
            gateAutoAssign: d.gateAutoAssign ?? INITIAL.gateAutoAssign,
            gateAutoAssignMethod: d.gateAutoAssignMethod ?? INITIAL.gateAutoAssignMethod,
            gateCodeLength: d.gateCodeLength ?? INITIAL.gateCodeLength,
            gateAutoLockout: d.gateAutoLockout ?? INITIAL.gateAutoLockout,
            gateTextToOpen: d.gateTextToOpen ?? INITIAL.gateTextToOpen,
            gateTextToOpenNumber: d.gateTextToOpenNumber ?? INITIAL.gateTextToOpenNumber,
            gateControllerType: d.gateControllerType ?? INITIAL.gateControllerType,
            gateNodeId: d.gateNodeId ?? INITIAL.gateNodeId,
            gateApiEndpoint: d.gateApiEndpoint ?? INITIAL.gateApiEndpoint,
            gateApiKey: d.gateApiKey ?? INITIAL.gateApiKey,
          }
          setForm(vals)
          setSaved(vals)
        }
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Save failed')
      setSaved({ ...form })
      setSavedOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }, [form])

  // ── Dirty check ──────────────────────────────────────────────────────────

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved)

  // ── Helpers ──────────────────────────────────────────────────────────────

  const set = <K extends keyof GateFormValues>(key: K, value: GateFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const controllerConnected = !!form.gateControllerType && !!form.gateNodeId

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button
          component={Link} href="/admin/settings"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}
        >
          Setup
        </Button>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06', flex: 1 }}>
          Gate Settings
        </Typography>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !isDirty}
          sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, '&.Mui-disabled': { bgcolor: '#D4B87A', color: 'white' }, textTransform: 'none', fontWeight: 600, px: 2.5 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}

      {/* Connection status banner */}
      <Alert
        severity={controllerConnected ? 'success' : 'info'}
        icon={<RouterIcon />}
        sx={{ mb: 3, borderRadius: 2 }}
      >
        {controllerConnected
          ? <><strong>Controller configured:</strong> {form.gateControllerType.toUpperCase()} — Node {form.gateNodeId}. Gate hardware sync will activate once the API integration is completed.</>
          : <><strong>No gate controller connected.</strong> Configure your gate controller below. Access codes are managed in the database and will sync with physical keypads once connected.</>
        }
      </Alert>

      <Grid container spacing={3}>
        {/* ── Gate Integration Card ───────────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SensorsIcon sx={{ color: '#B8914A' }} />
                <Typography variant="subtitle1" fontWeight={700}>Gate Integration</Typography>
              </Box>

              <TextField
                label="Controller Type"
                select fullWidth size="small"
                value={form.gateControllerType}
                onChange={(e) => set('gateControllerType', e.target.value)}
                SelectProps={{ native: true }}
                sx={{ mb: 2, ...inputSx }}
              >
                <option value="">Select controller...</option>
                <option value="ess">ESS Cloud Node</option>
                <option value="pti">PTI EasyCode</option>
                <option value="doorking">DoorKing</option>
                <option value="liftmaster">LiftMaster</option>
                <option value="custom">Custom / API</option>
              </TextField>

              <TextField
                label="Node / Device ID"
                placeholder="e.g. 1073R57"
                fullWidth size="small"
                value={form.gateNodeId}
                onChange={(e) => set('gateNodeId', e.target.value)}
                sx={{ mb: 2, ...inputSx }}
              />

              <TextField
                label="API Endpoint (optional)"
                placeholder="https://api.gatecontroller.com/v1"
                fullWidth size="small"
                value={form.gateApiEndpoint}
                onChange={(e) => set('gateApiEndpoint', e.target.value)}
                sx={{ mb: 2, ...inputSx }}
              />

              <TextField
                label="API Key / Secret"
                type="password"
                placeholder="Enter API key"
                fullWidth size="small"
                value={form.gateApiKey}
                onChange={(e) => set('gateApiKey', e.target.value)}
                sx={{ mb: 2, ...inputSx }}
              />

              <Button
                variant="contained" fullWidth
                disabled={!controllerConnected}
                sx={{ bgcolor: '#B8914A', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#9A7A3E' }, '&.Mui-disabled': { bgcolor: '#D4B87A', color: 'white' } }}
              >
                Test Connection
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                {controllerConnected ? 'Click to verify the connection to your gate controller' : 'Select a controller and enter a device ID to test'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Access Code Settings Card ───────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <KeyIcon sx={{ color: '#B8914A' }} />
                <Typography variant="subtitle1" fontWeight={700}>Access Code Settings</Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>Auto-assign codes on rental</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Automatically generate a gate code when a unit is rented
                  </Typography>
                </Box>
                <Switch checked={form.gateAutoAssign} onChange={(e) => set('gateAutoAssign', e.target.checked)} sx={switchSx} />
              </Box>

              {form.gateAutoAssign && (
                <Box sx={{ ml: 1, mb: 2, pl: 2, borderLeft: '2px solid #EDE5D8' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Code generation method
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {([
                      { value: 'phone_last4' as const, label: 'Last 4 of phone' },
                      { value: 'random' as const, label: 'Random code' },
                    ]).map((opt) => (
                      <Chip
                        key={opt.value} label={opt.label} size="small"
                        onClick={() => set('gateAutoAssignMethod', opt.value)}
                        sx={{
                          fontWeight: 500, cursor: 'pointer',
                          bgcolor: form.gateAutoAssignMethod === opt.value ? '#B8914A' : 'transparent',
                          color: form.gateAutoAssignMethod === opt.value ? 'white' : 'text.primary',
                          border: `1px solid ${form.gateAutoAssignMethod === opt.value ? '#B8914A' : '#EDE5D8'}`,
                          '&:hover': { bgcolor: form.gateAutoAssignMethod === opt.value ? '#9A7A3E' : '#f5f0e8' },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              <TextField
                label="Code length" select fullWidth size="small"
                value={String(form.gateCodeLength)}
                onChange={(e) => set('gateCodeLength', Number(e.target.value))}
                SelectProps={{ native: true }}
                sx={{ mb: 2, ...inputSx }}
              >
                <option value="4">4 digits</option>
                <option value="5">5 digits</option>
                <option value="6">6 digits</option>
              </TextField>

              <Divider sx={{ my: 2, borderColor: '#EDE5D8' }} />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>Auto lockout on delinquency</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Disable gate code when tenant becomes delinquent
                  </Typography>
                </Box>
                <Switch checked={form.gateAutoLockout} onChange={(e) => set('gateAutoLockout', e.target.checked)} sx={switchSx} />
              </Box>

              <Divider sx={{ my: 2, borderColor: '#EDE5D8' }} />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SmsIcon sx={{ fontSize: 16, color: '#B8914A' }} />
                    <Typography variant="body2" fontWeight={600}>Text-to-Open</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Tenants text &quot;open&quot; to open the gate
                  </Typography>
                </Box>
                <Switch checked={form.gateTextToOpen} onChange={(e) => set('gateTextToOpen', e.target.checked)} sx={switchSx} />
              </Box>
              {form.gateTextToOpen && (
                <TextField
                  label="Text-to-Open Number"
                  value={form.gateTextToOpenNumber}
                  onChange={(e) => set('gateTextToOpenNumber', e.target.value)}
                  fullWidth size="small"
                  placeholder="(555) 555-5555"
                  sx={{ mt: 1.5, ...inputSx }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Gates Table ─────────────────────────────────────────── */}
        <Grid item xs={12}>
          <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LockIcon sx={{ color: '#B8914A' }} />
                  <Typography variant="subtitle1" fontWeight={700}>Gates</Typography>
                </Box>
                <Button size="small" startIcon={<AddIcon />} disabled={!controllerConnected}
                  sx={{ textTransform: 'none', color: '#B8914A', fontWeight: 600 }}>
                  Add Gate
                </Button>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gate</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {DEFAULT_GATES.map((gate) => (
                      <TableRow key={gate.id} hover>
                        <TableCell><Typography variant="body2" fontWeight={500}>{gate.name}</Typography></TableCell>
                        <TableCell>
                          <Chip label={gate.type === 'entry' ? 'Entry' : 'Exit'} size="small"
                            sx={{ bgcolor: gate.type === 'entry' ? '#D1FAE5' : '#F3F4F6', color: gate.type === 'entry' ? '#065F46' : '#374151', fontWeight: 500, fontSize: '0.75rem' }} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: controllerConnected ? '#10B981' : '#9CA3AF' }} />
                            <Typography variant="body2" sx={{ color: controllerConnected ? '#065F46' : '#6B7280' }}>
                              {controllerConnected ? 'Online' : 'Not connected'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit"><IconButton size="small" disabled={!controllerConnected}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" disabled={!controllerConnected}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                {controllerConnected ? 'Gates detected from your controller.' : 'Gates will be detected automatically once the controller is connected.'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Gate Groups Table ───────────────────────────────────── */}
        <Grid item xs={12}>
          <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GroupIcon sx={{ color: '#B8914A' }} />
                  <Typography variant="subtitle1" fontWeight={700}>Gate Groups</Typography>
                </Box>
                <Button size="small" startIcon={<AddIcon />} disabled={!controllerConnected}
                  sx={{ textTransform: 'none', color: '#B8914A', fontWeight: 600 }}>
                  Add Group
                </Button>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Access Hours</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customers</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Units</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {DEFAULT_GATE_GROUPS.map((group) => (
                      <TableRow key={group.id} hover>
                        <TableCell><Typography variant="body2" fontWeight={500}>{group.name}</Typography></TableCell>
                        <TableCell>
                          {group.accessStart === '00:00' && group.accessEnd === '23:59'
                            ? <Chip label="24/7" size="small" sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 500, fontSize: '0.75rem' }} />
                            : <Typography variant="body2">{group.accessStart} – {group.accessEnd}</Typography>
                          }
                        </TableCell>
                        <TableCell><Typography variant="body2">{group.customerCount}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{group.unitCount}</Typography></TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit"><IconButton size="small" disabled={!controllerConnected}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" disabled={!controllerConnected}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Gate groups define access hours for different sets of customers and units.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Success snackbar */}
      <Snackbar open={savedOpen} autoHideDuration={3000} onClose={() => setSavedOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSavedOpen(false)} severity="success" variant="filled"
          sx={{ bgcolor: '#B8914A', color: 'white', fontWeight: 500, '& .MuiAlert-icon': { color: 'white' } }}>
          Gate settings saved
        </Alert>
      </Snackbar>
    </Box>
  )
}
