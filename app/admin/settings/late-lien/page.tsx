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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Snackbar,
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
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EmailIcon from '@mui/icons-material/Email'
import SmsIcon from '@mui/icons-material/Sms'
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop'
import LockIcon from '@mui/icons-material/Lock'
import GavelIcon from '@mui/icons-material/Gavel'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

// ── Types ────────────────────────────────────────────────────────────────────

type EventStatus = 'late' | 'locked_out' | 'pre_lien' | 'lien' | 'auction'

interface EventFee {
  name: string
  amount: number // cents
}

interface LateLienEvent {
  id: string
  status: EventStatus
  daysPastDue: number
  notifyEmail: boolean
  notifyText: boolean
  notifyLetter: boolean
  notificationTemplate: string
  fees: EventFee[]
  actions: string[]
}

const STATUS_CONFIG: Record<EventStatus, { label: string; color: string; bg: string }> = {
  late:       { label: 'Late',       color: '#92400E', bg: '#FEF3C7' },
  locked_out: { label: 'Locked Out', color: '#991B1B', bg: '#FEE2E2' },
  pre_lien:   { label: 'Pre-Lien',   color: '#7C3AED', bg: '#EDE9FE' },
  lien:       { label: 'Lien',       color: '#1E40AF', bg: '#DBEAFE' },
  auction:    { label: 'Auction',    color: '#065F46', bg: '#D1FAE5' },
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`

const EMPTY_EVENT: Omit<LateLienEvent, 'id'> = {
  status: 'late',
  daysPastDue: 0,
  notifyEmail: false,
  notifyText: false,
  notifyLetter: false,
  notificationTemplate: '',
  fees: [],
  actions: [],
}

// ── Styles ───────────────────────────────────────────────────────────────────

const inputSx = { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#EDE5D8' }, '&:hover fieldset': { borderColor: '#B8914A' }, '&.Mui-focused fieldset': { borderColor: '#B8914A' } } }
const thSx = { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

// ── Default events ───────────────────────────────────────────────────────────

const DEFAULT_EVENTS: LateLienEvent[] = [
  { id: 'evt_late_1',     status: 'late',       daysPastDue: 1,  notifyEmail: false, notifyText: false, notifyLetter: false, notificationTemplate: '',                                                                                         fees: [],                                                                          actions: [] },
  { id: 'evt_late_4',     status: 'late',       daysPastDue: 4,  notifyEmail: true,  notifyText: true,  notifyLetter: false, notificationTemplate: 'Past Due Warning',                                                                           fees: [],                                                                          actions: [] },
  { id: 'evt_late_5',     status: 'late',       daysPastDue: 5,  notifyEmail: true,  notifyText: true,  notifyLetter: false, notificationTemplate: 'Past Due Notice',                                                                             fees: [{ name: 'Past Due Fee', amount: 2000 }],                                    actions: [] },
  { id: 'evt_lockout_9',  status: 'locked_out', daysPastDue: 9,  notifyEmail: true,  notifyText: true,  notifyLetter: false, notificationTemplate: 'Past Due Notice',                                                                             fees: [],                                                                          actions: ['lockout'] },
  { id: 'evt_prelien_15', status: 'pre_lien',   daysPastDue: 15, notifyEmail: true,  notifyText: true,  notifyLetter: false, notificationTemplate: 'Notice of Lockout of Storage Unit / Notice of Intended Sale of Personal Property At Auction', fees: [],                                                                          actions: [] },
  { id: 'evt_lien_30',    status: 'lien',       daysPastDue: 30, notifyEmail: true,  notifyText: true,  notifyLetter: false, notificationTemplate: 'Notice of Lockout of Storage Unit / Notice of Intended Sale of Personal Property At Auction', fees: [],                                                                          actions: [] },
  { id: 'evt_auction_37', status: 'auction',    daysPastDue: 37, notifyEmail: true,  notifyText: true,  notifyLetter: true,  notificationTemplate: 'Notice of Foreclosure of Lien and Sale of Personal Property',                                 fees: [{ name: 'Advertisement Fee', amount: 2500 }, { name: 'Cut Lock Fee', amount: 2000 }], actions: ['queue_print'] },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LateLienSettingsPage() {
  const [events, setEvents] = useState<LateLienEvent[]>([])
  const [savedJson, setSavedJson] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fee catalog (built-in + custom from Fees & Charges page)
  const [feeCatalog, setFeeCatalog] = useState<EventFee[]>([])

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_EVENT)
  const [feeRows, setFeeRows] = useState<EventFee[]>([])

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const isDirty = JSON.stringify(events) !== savedJson

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const d = json.data

          // Load late/lien events
          const loaded = (d.lateLienEvents && d.lateLienEvents.length > 0)
            ? d.lateLienEvents
            : DEFAULT_EVENTS
          setEvents(loaded)
          setSavedJson(JSON.stringify(loaded))

          // Build fee catalog from built-in + custom fees
          const catalog: EventFee[] = []
          if (d.lateFeeAmount)    catalog.push({ name: 'Late Fee',               amount: d.lateFeeAmount })
          if (d.nsfFeeAmount)     catalog.push({ name: 'NSF / Returned Check',   amount: d.nsfFeeAmount })
          if (d.auctionFeeAmount) catalog.push({ name: 'Auction / Sale Fee',     amount: d.auctionFeeAmount })
          if (d.customFees) {
            for (const cf of d.customFees) {
              if (cf.active) catalog.push({ name: cf.name, amount: cf.amount })
            }
          }
          setFeeCatalog(catalog)
        }
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true); setError(null)
    try {
      const sorted = [...events].sort((a, b) => a.daysPastDue - b.daysPastDue)
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lateLienEvents: sorted }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Save failed')
      setEvents(sorted)
      setSavedJson(JSON.stringify(sorted))
      setSavedOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }, [events])

  // ── Dialog helpers ───────────────────────────────────────────────────────

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_EVENT)
    setFeeRows([])
    setDialogOpen(true)
  }

  function openEdit(evt: LateLienEvent) {
    setEditingId(evt.id)
    setForm({ status: evt.status, daysPastDue: evt.daysPastDue, notifyEmail: evt.notifyEmail, notifyText: evt.notifyText, notifyLetter: evt.notifyLetter, notificationTemplate: evt.notificationTemplate, fees: evt.fees, actions: [...evt.actions] })
    setFeeRows([...evt.fees])
    setDialogOpen(true)
  }

  function handleDialogSave() {
    const cleaned: LateLienEvent = {
      id: editingId ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...form,
      fees: feeRows.filter((f) => f.name.trim()),
    }
    if (editingId) {
      setEvents((prev) => prev.map((e) => e.id === editingId ? cleaned : e).sort((a, b) => a.daysPastDue - b.daysPastDue))
    } else {
      setEvents((prev) => [...prev, cleaned].sort((a, b) => a.daysPastDue - b.daysPastDue))
    }
    setDialogOpen(false)
  }

  function handleDelete() {
    if (!deleteId) return
    setEvents((prev) => prev.filter((e) => e.id !== deleteId))
    setDeleteId(null)
  }

  function removeFeeRow(idx: number) {
    setFeeRows((prev) => prev.filter((_, i) => i !== idx))
  }

  function toggleAction(action: string) {
    setForm((prev) => {
      const has = prev.actions.includes(action)
      return { ...prev, actions: has ? prev.actions.filter((a) => a !== action) : [...prev.actions, action] }
    })
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  // ── Sorted events ────────────────────────────────────────────────────────

  const sorted = [...events].sort((a, b) => a.daysPastDue - b.daysPastDue)

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button
          component={Link} href="/admin/settings"
          startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}
        >
          Setup
        </Button>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06', flex: 1 }}>
          Late / Lien Settings
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

      {/* Description */}
      <Alert severity="info" icon={<WarningAmberIcon />} sx={{ mb: 3, borderRadius: 2 }}>
        Configure what happens when rent remains unpaid past its due date. Each event triggers at a specific number of days past due and can apply fees, send notifications, lock out the tenant, or queue printed notices.
      </Alert>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}

      {/* Timeline Table */}
      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GavelIcon sx={{ color: '#B8914A' }} />
              <Typography variant="subtitle1" fontWeight={700}>Escalation Timeline</Typography>
            </Box>
            <Button size="small" startIcon={<AddIcon />} onClick={openNew}
              sx={{ textTransform: 'none', color: '#B8914A', fontWeight: 600 }}>
              Add Event
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Status</TableCell>
                  <TableCell sx={thSx} align="center">Days Past Due</TableCell>
                  <TableCell sx={thSx}>Notifications</TableCell>
                  <TableCell sx={thSx}>Fees</TableCell>
                  <TableCell sx={{ ...thSx, display: { xs: 'none', md: 'table-cell' } }}>Actions</TableCell>
                  <TableCell sx={thSx} align="right">Edit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((evt) => {
                  const sc = STATUS_CONFIG[evt.status]
                  const notifs: string[] = []
                  if (evt.notifyEmail) notifs.push('Email')
                  if (evt.notifyText) notifs.push('Text')
                  if (evt.notifyLetter) notifs.push('Letter')

                  return (
                    <TableRow key={evt.id} hover>
                      {/* Status */}
                      <TableCell>
                        <Chip label={sc.label} size="small"
                          sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, fontSize: '0.75rem' }} />
                      </TableCell>

                      {/* Days */}
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={700} sx={{ fontSize: '1.1rem', color: '#1C0F06' }}>
                          {evt.daysPastDue}
                        </Typography>
                      </TableCell>

                      {/* Notifications */}
                      <TableCell>
                        {notifs.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">No notifications</Typography>
                        ) : (
                          <Box>
                            <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                              {evt.notifyEmail && <Tooltip title="Email"><EmailIcon sx={{ fontSize: 16, color: '#B8914A' }} /></Tooltip>}
                              {evt.notifyText && <Tooltip title="Text/SMS"><SmsIcon sx={{ fontSize: 16, color: '#B8914A' }} /></Tooltip>}
                              {evt.notifyLetter && <Tooltip title="Printed Letter"><LocalPrintshopIcon sx={{ fontSize: 16, color: '#B8914A' }} /></Tooltip>}
                            </Box>
                            {evt.notificationTemplate && (
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, display: 'block', maxWidth: 280 }}>
                                {evt.notificationTemplate}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </TableCell>

                      {/* Fees */}
                      <TableCell>
                        {evt.fees.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">No fees</Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                            {evt.fees.map((f, i) => (
                              <Typography key={i} variant="body2" sx={{ fontSize: '0.8rem' }}>
                                <span style={{ fontWeight: 500 }}>{f.name}:</span>{' '}
                                <span style={{ fontWeight: 700, color: '#991B1B' }}>{fmt(f.amount)}</span>
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        {evt.actions.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">—</Typography>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {evt.actions.includes('lockout') && (
                              <Chip icon={<LockIcon sx={{ fontSize: '14px !important' }} />} label="Lockout" size="small"
                                sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 500, fontSize: '0.7rem', '& .MuiChip-icon': { color: '#991B1B' } }} />
                            )}
                            {evt.actions.includes('queue_print') && (
                              <Chip icon={<LocalPrintshopIcon sx={{ fontSize: '14px !important' }} />} label="Print Batch" size="small"
                                sx={{ bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 500, fontSize: '0.7rem', '& .MuiChip-icon': { color: '#1E40AF' } }} />
                            )}
                          </Box>
                        )}
                      </TableCell>

                      {/* Edit/Delete */}
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(evt)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => setDeleteId(evt.id)}>
                            <DeleteOutlineIcon fontSize="small" sx={{ color: '#EF4444' }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>No escalation events configured</Typography>
                      <Button size="small" startIcon={<AddIcon />} onClick={openNew}
                        sx={{ textTransform: 'none', color: '#B8914A', fontWeight: 600 }}>
                        Add your first event
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ── Add/Edit Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700 }}>
          {editingId ? 'Edit Event' : 'Add Escalation Event'}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* Status + Days */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Status" select fullWidth size="small"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as EventStatus }))}
                SelectProps={{ native: true }}
                sx={{ flex: 1, ...inputSx }}
              >
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </TextField>
              <TextField
                label="Days Past Due" type="number" size="small"
                value={form.daysPastDue}
                onChange={(e) => setForm((p) => ({ ...p, daysPastDue: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                inputProps={{ min: 0 }}
                sx={{ width: 140, ...inputSx }}
              />
            </Box>

            <Divider sx={{ borderColor: '#EDE5D8' }} />

            {/* Notifications */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Notifications</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={form.notifyEmail} onChange={(e) => setForm((p) => ({ ...p, notifyEmail: e.target.checked }))} sx={{ color: '#B8914A', '&.Mui-checked': { color: '#B8914A' } }} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><EmailIcon sx={{ fontSize: 16 }} /> Email</Box>}
                />
                <FormControlLabel
                  control={<Checkbox size="small" checked={form.notifyText} onChange={(e) => setForm((p) => ({ ...p, notifyText: e.target.checked }))} sx={{ color: '#B8914A', '&.Mui-checked': { color: '#B8914A' } }} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><SmsIcon sx={{ fontSize: 16 }} /> Text</Box>}
                />
                <FormControlLabel
                  control={<Checkbox size="small" checked={form.notifyLetter} onChange={(e) => setForm((p) => ({ ...p, notifyLetter: e.target.checked }))} sx={{ color: '#B8914A', '&.Mui-checked': { color: '#B8914A' } }} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><LocalPrintshopIcon sx={{ fontSize: 16 }} /> Letter</Box>}
                />
              </Box>
              <TextField
                label="Notification template / description"
                fullWidth size="small" multiline rows={2}
                value={form.notificationTemplate}
                onChange={(e) => setForm((p) => ({ ...p, notificationTemplate: e.target.value }))}
                placeholder="e.g. Past Due Warning, Notice of Intended Sale..."
                sx={inputSx}
              />
            </Box>

            <Divider sx={{ borderColor: '#EDE5D8' }} />

            {/* Fees */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>Fees Applied</Typography>
              </Box>

              {/* Catalog select to add a fee */}
              <TextField
                label="Add fee from catalog" select fullWidth size="small"
                value=""
                onChange={(e) => {
                  const selected = feeCatalog.find((f) => f.name === e.target.value)
                  if (selected) setFeeRows((prev) => [...prev, { ...selected }])
                }}
                SelectProps={{ native: true }}
                sx={{ mb: 1.5, ...inputSx }}
              >
                <option value="">— Choose a fee to add —</option>
                {feeCatalog.filter((f) => !feeRows.some((r) => r.name === f.name)).map((f) => (
                  <option key={f.name} value={f.name}>{f.name} ({fmt(f.amount)})</option>
                ))}
              </TextField>
              {feeCatalog.length === 0 && (
                <Alert severity="info" sx={{ mb: 1.5, borderRadius: 1, py: 0 }}>
                  <Typography variant="caption">
                    No fees configured yet.{' '}
                    <Link href="/admin/settings/fees" style={{ color: '#B8914A', fontWeight: 600 }}>
                      Go to Fees &amp; Charges
                    </Link>{' '}
                    to create fees first.
                  </Typography>
                </Alert>
              )}

              {feeRows.length === 0 ? (
                <Typography variant="caption" color="text.secondary">No fees for this event</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {feeRows.map((row, idx) => (
                    <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', bgcolor: '#FAF7F2', borderRadius: 1, px: 1.5, py: 1 }}>
                      <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>{row.name}</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#991B1B' }}>{fmt(row.amount)}</Typography>
                      <IconButton size="small" onClick={() => removeFeeRow(idx)}>
                        <DeleteOutlineIcon fontSize="small" sx={{ color: '#EF4444' }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Divider sx={{ borderColor: '#EDE5D8' }} />

            {/* Actions */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Automated Actions</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={form.actions.includes('lockout')} onChange={() => toggleAction('lockout')} sx={{ color: '#991B1B', '&.Mui-checked': { color: '#991B1B' } }} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><LockIcon sx={{ fontSize: 16, color: '#991B1B' }} /> Lock out tenant</Box>}
                />
                <FormControlLabel
                  control={<Checkbox size="small" checked={form.actions.includes('queue_print')} onChange={() => toggleAction('queue_print')} sx={{ color: '#1E40AF', '&.Mui-checked': { color: '#1E40AF' } }} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><LocalPrintshopIcon sx={{ fontSize: 16, color: '#1E40AF' }} /> Queue print batch</Box>}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" onClick={handleDialogSave}
            sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}>
            {editingId ? 'Update' : 'Add Event'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>Delete Event?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This escalation event will be removed from the timeline.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} sx={{ textTransform: 'none', fontWeight: 600 }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Success snackbar */}
      <Snackbar open={savedOpen} autoHideDuration={3000} onClose={() => setSavedOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSavedOpen(false)} severity="success" variant="filled"
          sx={{ bgcolor: '#B8914A', color: 'white', fontWeight: 500, '& .MuiAlert-icon': { color: 'white' } }}>
          Late/Lien settings saved
        </Alert>
      </Snackbar>
    </Box>
  )
}
