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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
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
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ReceiptIcon from '@mui/icons-material/Receipt'

// ── Types ────────────────────────────────────────────────────────────────────

interface CustomFee {
  id: string
  name: string
  amount: number // cents
  description: string
  active: boolean
}

interface BuiltInFees {
  lateFeeAfterDays: number
  lateFeeAmount: number   // cents
  nsfFeeAmount: number    // cents
  auctionFeeAmount: number // cents
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`

// ── Shared styles ────────────────────────────────────────────────────────────

const inputSx = { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#EDE5D8' }, '&:hover fieldset': { borderColor: '#B8914A' }, '&.Mui-focused fieldset': { borderColor: '#B8914A' } } }
const switchSx = { '& .MuiSwitch-switchBase.Mui-checked': { color: '#B8914A' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#B8914A' } }

const thSx = { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FeesSettingsPage() {
  const [builtIn, setBuiltIn] = useState<BuiltInFees>({ lateFeeAfterDays: 5, lateFeeAmount: 2000, nsfFeeAmount: 3500, auctionFeeAmount: 5000 })
  const [customFees, setCustomFees] = useState<CustomFee[]>([])
  const [savedJson, setSavedJson] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null) // null = new, else editing
  const [editingBuiltIn, setEditingBuiltIn] = useState<'late' | 'nsf' | 'auction' | null>(null)
  const [dialogForm, setDialogForm] = useState({ name: '', amount: '', description: '', active: true, days: '' })

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const currentJson = JSON.stringify({ builtIn, customFees })
  const isDirty = currentJson !== savedJson

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const d = json.data
          const b: BuiltInFees = {
            lateFeeAfterDays: d.lateFeeAfterDays ?? 5,
            lateFeeAmount: d.lateFeeAmount ?? 2000,
            nsfFeeAmount: d.nsfFeeAmount ?? 3500,
            auctionFeeAmount: d.auctionFeeAmount ?? 5000,
          }
          setBuiltIn(b)
          setCustomFees(d.customFees ?? [])
          setSavedJson(JSON.stringify({ builtIn: b, customFees: d.customFees ?? [] }))
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
        body: JSON.stringify({ ...builtIn, customFees }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Save failed')
      setSavedJson(JSON.stringify({ builtIn, customFees }))
      setSavedOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }, [builtIn, customFees])

  // ── Built-in fee edit dialog ─────────────────────────────────────────────

  function openBuiltInEdit(type: 'late' | 'nsf' | 'auction') {
    setEditingBuiltIn(type)
    setEditingId(null)
    if (type === 'late') {
      setDialogForm({ name: 'Late Fee', amount: (builtIn.lateFeeAmount / 100).toFixed(2), description: `Applied after ${builtIn.lateFeeAfterDays} days past due`, active: true, days: String(builtIn.lateFeeAfterDays) })
    } else if (type === 'nsf') {
      setDialogForm({ name: 'NSF / Returned Check Fee', amount: (builtIn.nsfFeeAmount / 100).toFixed(2), description: 'Non-sufficient funds or returned check', active: true, days: '' })
    } else {
      setDialogForm({ name: 'Auction / Sale Fee', amount: (builtIn.auctionFeeAmount / 100).toFixed(2), description: 'Lien sale processing fee', active: true, days: '' })
    }
    setDialogOpen(true)
  }

  function openCustomEdit(fee: CustomFee) {
    setEditingBuiltIn(null)
    setEditingId(fee.id)
    setDialogForm({ name: fee.name, amount: (fee.amount / 100).toFixed(2), description: fee.description, active: fee.active, days: '' })
    setDialogOpen(true)
  }

  function openNewFee() {
    setEditingBuiltIn(null)
    setEditingId(null)
    setDialogForm({ name: '', amount: '', description: '', active: true, days: '' })
    setDialogOpen(true)
  }

  function handleDialogSave() {
    const amountCents = Math.round(parseFloat(dialogForm.amount || '0') * 100)

    if (editingBuiltIn) {
      if (editingBuiltIn === 'late') {
        setBuiltIn((prev) => ({ ...prev, lateFeeAmount: amountCents, lateFeeAfterDays: parseInt(dialogForm.days, 10) || 0 }))
      } else if (editingBuiltIn === 'nsf') {
        setBuiltIn((prev) => ({ ...prev, nsfFeeAmount: amountCents }))
      } else {
        setBuiltIn((prev) => ({ ...prev, auctionFeeAmount: amountCents }))
      }
    } else if (editingId) {
      setCustomFees((prev) => prev.map((f) => f.id === editingId ? { ...f, name: dialogForm.name, amount: amountCents, description: dialogForm.description, active: dialogForm.active } : f))
    } else {
      // New
      if (!dialogForm.name.trim()) return
      setCustomFees((prev) => [...prev, {
        id: `fee_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: dialogForm.name.trim(),
        amount: amountCents,
        description: dialogForm.description.trim(),
        active: dialogForm.active,
      }])
    }
    setDialogOpen(false)
  }

  function handleDelete() {
    if (!deleteId) return
    setCustomFees((prev) => prev.filter((f) => f.id !== deleteId))
    setDeleteId(null)
  }

  function toggleCustomActive(id: string) {
    setCustomFees((prev) => prev.map((f) => f.id === id ? { ...f, active: !f.active } : f))
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  // ── Compose all fees for the table ───────────────────────────────────────

  const allFees = [
    { id: '_late', name: 'Late Fee', amount: builtIn.lateFeeAmount, description: `After ${builtIn.lateFeeAfterDays} day${builtIn.lateFeeAfterDays !== 1 ? 's' : ''} past due`, active: true, builtIn: 'late' as const },
    { id: '_nsf', name: 'NSF / Returned Check', amount: builtIn.nsfFeeAmount, description: 'Non-sufficient funds or returned check', active: true, builtIn: 'nsf' as const },
    { id: '_auction', name: 'Auction / Sale Fee', amount: builtIn.auctionFeeAmount, description: 'Lien sale processing fee', active: true, builtIn: 'auction' as const },
    ...customFees.map((f) => ({ ...f, builtIn: null as null })),
  ]

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
          Fees &amp; Charges
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

      {/* Fees Table */}
      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReceiptIcon sx={{ color: '#B8914A' }} />
              <Typography variant="subtitle1" fontWeight={700}>Fee Schedule</Typography>
            </Box>
            <Button
              size="small" startIcon={<AddIcon />}
              onClick={openNewFee}
              sx={{ textTransform: 'none', color: '#B8914A', fontWeight: 600 }}
            >
              Add Fee
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Fee Name</TableCell>
                  <TableCell sx={thSx}>Amount</TableCell>
                  <TableCell sx={{ ...thSx, display: { xs: 'none', sm: 'table-cell' } }}>Description</TableCell>
                  <TableCell sx={thSx} align="center">Status</TableCell>
                  <TableCell sx={thSx} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allFees.map((fee) => (
                  <TableRow key={fee.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{fee.name}</Typography>
                        {fee.builtIn && (
                          <Chip label="Built-in" size="small"
                            sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#F3F4F6', color: '#6B7280', fontWeight: 500 }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#1C0F06' }}>
                        {fmt(fee.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Typography variant="body2" color="text.secondary">{fee.description}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      {fee.builtIn ? (
                        <Chip label="Active" size="small"
                          sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 500, fontSize: '0.75rem' }} />
                      ) : (
                        <Switch
                          size="small"
                          checked={fee.active}
                          onChange={() => toggleCustomActive(fee.id)}
                          sx={switchSx}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small"
                          onClick={() => fee.builtIn ? openBuiltInEdit(fee.builtIn) : openCustomEdit(fee as CustomFee)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {!fee.builtIn && (
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => setDeleteId(fee.id)}>
                            <DeleteOutlineIcon fontSize="small" sx={{ color: '#EF4444' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {allFees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      No fees configured
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700 }}>
          {editingBuiltIn ? `Edit ${dialogForm.name}` : editingId ? 'Edit Fee' : 'Add New Fee'}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Fee Name"
              fullWidth size="small"
              value={dialogForm.name}
              onChange={(e) => setDialogForm((p) => ({ ...p, name: e.target.value }))}
              disabled={!!editingBuiltIn}
              sx={inputSx}
            />
            <TextField
              label="Amount"
              type="number"
              fullWidth size="small"
              value={dialogForm.amount}
              onChange={(e) => setDialogForm((p) => ({ ...p, amount: e.target.value }))}
              inputProps={{ min: 0, step: 0.01 }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              sx={inputSx}
            />
            {editingBuiltIn === 'late' && (
              <TextField
                label="Days past due before applying"
                type="number"
                fullWidth size="small"
                value={dialogForm.days}
                onChange={(e) => setDialogForm((p) => ({ ...p, days: e.target.value }))}
                inputProps={{ min: 0 }}
                helperText="Number of days after the due date before the late fee is applied"
                sx={inputSx}
              />
            )}
            <TextField
              label="Description"
              fullWidth size="small" multiline rows={2}
              value={dialogForm.description}
              onChange={(e) => setDialogForm((p) => ({ ...p, description: e.target.value }))}
              disabled={!!editingBuiltIn}
              placeholder="When is this fee applied?"
              sx={inputSx}
            />
            {!editingBuiltIn && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight={500}>Active</Typography>
                <Switch
                  checked={dialogForm.active}
                  onChange={(e) => setDialogForm((p) => ({ ...p, active: e.target.checked }))}
                  sx={switchSx}
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button
            variant="contained" onClick={handleDialogSave}
            disabled={!editingBuiltIn && !editingId && !dialogForm.name.trim()}
            sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}
          >
            {editingBuiltIn || editingId ? 'Update' : 'Add Fee'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>Delete Fee?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This fee will be removed from the schedule. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success snackbar */}
      <Snackbar open={savedOpen} autoHideDuration={3000} onClose={() => setSavedOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSavedOpen(false)} severity="success" variant="filled"
          sx={{ bgcolor: '#B8914A', color: 'white', fontWeight: 500, '& .MuiAlert-icon': { color: 'white' } }}>
          Fee settings saved
        </Alert>
      </Snackbar>
    </Box>
  )
}
