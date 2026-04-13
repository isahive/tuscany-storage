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
  InputAdornment,
  Radio,
  RadioGroup,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ArchiveIcon from '@mui/icons-material/Archive'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PersonIcon from '@mui/icons-material/Person'
import QrCodeIcon from '@mui/icons-material/QrCode'

// ── Types ────────────────────────────────────────────────────────────────────

type Method = 'manual' | 'promo_code' | 'automatic'

interface Promotion {
  _id: string
  name: string
  description: string
  method: Method
  promoCode: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  unitTypes: string[]
  allUnitTypes: boolean
  startDate: string
  endDate: string | null
  beginsImmediately: boolean
  beginsAfterCycles: number
  noExpiration: boolean
  durationCycles: number
  status: 'active' | 'retired'
  appliedCount: number
}

interface FormState {
  name: string
  description: string
  method: Method
  promoCode: string
  discountType: 'percentage' | 'fixed'
  discountValue: string
  unitTypes: string[]
  allUnitTypes: boolean
  startDate: string
  endDate: string
  hasEndDate: boolean
  beginsImmediately: boolean
  beginsAfterCycles: string
  noExpiration: boolean
  durationCycles: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  method: 'manual',
  promoCode: '',
  discountType: 'percentage',
  discountValue: '',
  unitTypes: [],
  allUnitTypes: true,
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  hasEndDate: false,
  beginsImmediately: true,
  beginsAfterCycles: '0',
  noExpiration: true,
  durationCycles: '1',
}

const METHOD_CONFIG: Record<Method, { label: string; icon: React.ReactNode; color: string; bg: string; desc: string }> = {
  manual:     { label: 'Manual',    icon: <PersonIcon sx={{ fontSize: 16 }} />,      color: '#1E40AF', bg: '#DBEAFE', desc: 'Applied manually by Managers and Sales Associates.' },
  promo_code: { label: 'Promo Code', icon: <QrCodeIcon sx={{ fontSize: 16 }} />,     color: '#7C3AED', bg: '#EDE9FE', desc: 'Customers add a promo code during the rental process.' },
  automatic:  { label: 'Automatic', icon: <AutoAwesomeIcon sx={{ fontSize: 16 }} />, color: '#065F46', bg: '#D1FAE5', desc: 'Automatically applied to qualifying rentals.' },
}

const inputSx = { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#EDE5D8' }, '&:hover fieldset': { borderColor: '#B8914A' }, '&.Mui-focused fieldset': { borderColor: '#B8914A' } } }

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PromotionsPage() {
  const [promos, setPromos] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snack, setSnack] = useState<string | null>(null)

  // Available unit sizes for the selector
  const [unitSizes, setUnitSizes] = useState<string[]>([])

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadPromos = useCallback(() => {
    fetch('/api/promotions')
      .then((r) => r.json())
      .then((json) => { if (json.success) setPromos(json.data) })
      .catch(() => setError('Failed to load promotions'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadPromos() }, [loadPromos])

  // Load unit sizes
  useEffect(() => {
    fetch('/api/units?limit=500')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.items) {
          const sizes = [...new Set(json.data.items.map((u: { size: string }) => u.size))] as string[]
          setUnitSizes(sizes.sort())
        }
      })
      .catch(() => {})
  }, [])

  // ── Dialog ───────────────────────────────────────────────────────────────

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(p: Promotion) {
    setEditingId(p._id)
    setForm({
      name: p.name,
      description: p.description,
      method: p.method,
      promoCode: p.promoCode,
      discountType: p.discountType,
      discountValue: p.discountType === 'percentage' ? String(p.discountValue) : String(p.discountValue / 100),
      unitTypes: [...p.unitTypes],
      allUnitTypes: p.allUnitTypes,
      startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
      endDate: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : '',
      hasEndDate: !!p.endDate,
      beginsImmediately: p.beginsImmediately,
      beginsAfterCycles: String(p.beginsAfterCycles),
      noExpiration: p.noExpiration,
      durationCycles: String(p.durationCycles),
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!form.discountValue) { setFormError('Discount value is required'); return }
    if (form.method === 'promo_code' && !form.promoCode.trim()) { setFormError('Promo code is required'); return }

    setFormSaving(true); setFormError(null)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim(),
        method: form.method,
        promoCode: form.method === 'promo_code' ? form.promoCode.trim().toUpperCase() : '',
        discountType: form.discountType,
        discountValue: form.discountType === 'percentage'
          ? parseFloat(form.discountValue) || 0
          : Math.round((parseFloat(form.discountValue) || 0) * 100),
        unitTypes: form.allUnitTypes ? [] : form.unitTypes,
        allUnitTypes: form.allUnitTypes,
        startDate: form.startDate,
        endDate: form.hasEndDate && form.endDate ? form.endDate : null,
        beginsImmediately: form.beginsImmediately,
        beginsAfterCycles: form.beginsImmediately ? 0 : parseInt(form.beginsAfterCycles, 10) || 0,
        noExpiration: form.noExpiration,
        durationCycles: parseInt(form.durationCycles, 10) || 1,
      }

      if (editingId) body.id = editingId

      const res = await fetch('/api/promotions', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Save failed')

      setDialogOpen(false)
      setSnack(editingId ? 'Promotion updated' : 'Promotion created')
      loadPromos()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setFormSaving(false) }
  }

  // ── Delete / Retire ──────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/promotions?id=${deleteTarget._id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Delete failed')
      setSnack(json.retired ? 'Promotion retired (already applied to rentals)' : 'Promotion deleted')
      loadPromos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally { setDeleteTarget(null) }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  function toggleUnitType(size: string) {
    setForm((prev) => ({
      ...prev,
      unitTypes: prev.unitTypes.includes(size)
        ? prev.unitTypes.filter((s) => s !== size)
        : [...prev.unitTypes, size],
    }))
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  const activePromos = promos.filter((p) => p.status === 'active')
  const retiredPromos = promos.filter((p) => p.status === 'retired')

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button component={Link} href="/admin/settings" startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}>
          Setup
        </Button>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06', flex: 1 }}>
          Promotions
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}
          sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600, px: 2.5 }}>
          New Promotion
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Promotions provide a way to apply discounts to rentals — manually, through a promo code, or automatically per unit type.
        Promotions that have been applied to at least one rental can be retired but not deleted.
      </Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}

      {/* Active Promotions */}
      {activePromos.length === 0 && retiredPromos.length === 0 ? (
        <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <LocalOfferIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif', mb: 1 }}>No Promotions Yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Create your first promotion to start offering discounts to tenants.</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}
              sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}>
              Create Promotion
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {activePromos.map((p) => <PromoCard key={p._id} promo={p} onEdit={() => openEdit(p)} onDelete={() => setDeleteTarget(p)} />)}

          {retiredPromos.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ArchiveIcon sx={{ fontSize: 16 }} /> Retired Promotions
              </Typography>
              {retiredPromos.map((p) => <PromoCard key={p._id} promo={p} onEdit={() => openEdit(p)} retired />)}
            </>
          )}
        </Box>
      )}

      {/* ── Create / Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700 }}>
          {editingId ? 'Edit Promotion' : 'New Promotion'}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            <TextField label="Promotion Name" fullWidth size="small" value={form.name}
              onChange={(e) => set('name', e.target.value)} sx={inputSx} />

            <TextField label="Description" fullWidth size="small" multiline rows={2} value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="e.g. 5% off each month — visible to manager and customer"
              sx={inputSx} />

            <Divider sx={{ borderColor: '#EDE5D8' }} />

            {/* Availability */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Availability</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                Once applied to a rental, the promotion continues even after availability expires.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Start Date" type="date" size="small" fullWidth value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  InputLabelProps={{ shrink: true }} sx={inputSx} />
                <TextField label="End Date" type="date" size="small" fullWidth value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  disabled={!form.hasEndDate}
                  InputLabelProps={{ shrink: true }} sx={inputSx} />
              </Box>
              <FormControlLabel sx={{ mt: 0.5 }}
                control={<Checkbox size="small" checked={!form.hasEndDate}
                  onChange={(e) => set('hasEndDate', !e.target.checked)}
                  sx={{ color: '#B8914A', '&.Mui-checked': { color: '#B8914A' } }} />}
                label={<Typography variant="caption">No end date</Typography>} />
            </Box>

            <Divider sx={{ borderColor: '#EDE5D8' }} />

            {/* Method */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Method</Typography>
              <RadioGroup value={form.method} onChange={(e) => set('method', e.target.value as Method)}>
                {Object.entries(METHOD_CONFIG).map(([val, cfg]) => (
                  <Box key={val} sx={{ mb: 1 }}>
                    <FormControlLabel value={val}
                      control={<Radio size="small" sx={{ color: '#B8914A', '&.Mui-checked': { color: '#B8914A' } }} />}
                      label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{cfg.icon}<Typography variant="body2" fontWeight={600}>{cfg.label}</Typography></Box>} />
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 4, display: 'block', mt: -0.5 }}>{cfg.desc}</Typography>
                  </Box>
                ))}
              </RadioGroup>
              {form.method === 'promo_code' && (
                <TextField label="Promo Code" size="small" fullWidth value={form.promoCode}
                  onChange={(e) => set('promoCode', e.target.value.toUpperCase())}
                  placeholder="e.g. SUMMER2026"
                  sx={{ mt: 1, ...inputSx }} />
              )}
            </Box>

            <Divider sx={{ borderColor: '#EDE5D8' }} />

            {/* Unit Types */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Unit Types</Typography>
              <FormControlLabel
                control={<Checkbox size="small" checked={form.allUnitTypes}
                  onChange={(e) => set('allUnitTypes', e.target.checked)}
                  sx={{ color: '#B8914A', '&.Mui-checked': { color: '#B8914A' } }} />}
                label={<Typography variant="body2">All Unit Types</Typography>} />
              {!form.allUnitTypes && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1, ml: 1 }}>
                  {unitSizes.map((size) => (
                    <Chip key={size} label={size} size="small"
                      onClick={() => toggleUnitType(size)}
                      sx={{
                        cursor: 'pointer', fontWeight: 500,
                        bgcolor: form.unitTypes.includes(size) ? '#B8914A' : 'transparent',
                        color: form.unitTypes.includes(size) ? 'white' : 'text.primary',
                        border: `1px solid ${form.unitTypes.includes(size) ? '#B8914A' : '#EDE5D8'}`,
                        '&:hover': { bgcolor: form.unitTypes.includes(size) ? '#9A7A3E' : '#f5f0e8' },
                      }} />
                  ))}
                  {unitSizes.length === 0 && (
                    <Typography variant="caption" color="text.secondary">No unit sizes found in the system.</Typography>
                  )}
                </Box>
              )}
            </Box>

            <Divider sx={{ borderColor: '#EDE5D8' }} />

            {/* Discount */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Discount</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                {(['percentage', 'fixed'] as const).map((dt) => (
                  <Chip key={dt} label={dt === 'percentage' ? 'Percentage' : 'Fixed Amount'} size="small"
                    onClick={() => set('discountType', dt)}
                    sx={{
                      cursor: 'pointer', fontWeight: 500,
                      bgcolor: form.discountType === dt ? '#B8914A' : 'transparent',
                      color: form.discountType === dt ? 'white' : 'text.primary',
                      border: `1px solid ${form.discountType === dt ? '#B8914A' : '#EDE5D8'}`,
                      '&:hover': { bgcolor: form.discountType === dt ? '#9A7A3E' : '#f5f0e8' },
                    }} />
                ))}
              </Box>
              <TextField
                label={form.discountType === 'percentage' ? 'Discount %' : 'Discount Amount'}
                type="number" size="small"
                value={form.discountValue}
                onChange={(e) => set('discountValue', e.target.value)}
                inputProps={{ min: 0, step: form.discountType === 'percentage' ? 1 : 0.01 }}
                InputProps={{
                  endAdornment: form.discountType === 'percentage'
                    ? <InputAdornment position="end">%</InputAdornment>
                    : undefined,
                  startAdornment: form.discountType === 'fixed'
                    ? <InputAdornment position="start">$</InputAdornment>
                    : undefined,
                }}
                sx={{ width: 180, ...inputSx }}
              />
            </Box>

            <Divider sx={{ borderColor: '#EDE5D8' }} />

            {/* Timing */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Setup</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                When should the promotion begin upon renting a unit?
              </Typography>
              <RadioGroup value={form.beginsImmediately ? 'immediately' : 'after'}
                onChange={(e) => set('beginsImmediately', e.target.value === 'immediately')}>
                <FormControlLabel value="immediately"
                  control={<Radio size="small" sx={{ color: '#B8914A', '&.Mui-checked': { color: '#B8914A' } }} />}
                  label={<Typography variant="body2">Immediately</Typography>} />
                <FormControlLabel value="after"
                  control={<Radio size="small" sx={{ color: '#B8914A', '&.Mui-checked': { color: '#B8914A' } }} />}
                  label={<Typography variant="body2">After a number of billing cycles</Typography>} />
              </RadioGroup>
              {!form.beginsImmediately && (
                <TextField label="Begins after (cycles)" type="number" size="small"
                  value={form.beginsAfterCycles}
                  onChange={(e) => set('beginsAfterCycles', e.target.value)}
                  inputProps={{ min: 1 }}
                  sx={{ mt: 1, width: 180, ...inputSx }} />
              )}

              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={form.noExpiration}
                    onChange={(e) => set('noExpiration', e.target.checked)}
                    sx={{ color: '#B8914A', '&.Mui-checked': { color: '#B8914A' } }} />}
                  label={<Typography variant="body2">This promotion should not expire</Typography>} />
              </Box>

              {!form.noExpiration && (
                <TextField label="Duration (billing cycles)" type="number" size="small"
                  value={form.durationCycles}
                  onChange={(e) => set('durationCycles', e.target.value)}
                  inputProps={{ min: 1 }}
                  sx={{ mt: 1, width: 180, ...inputSx }} />
              )}
            </Box>
          </Box>

          {formError && <Alert severity="error" sx={{ mt: 2, borderRadius: 1 }}>{formError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={formSaving}
            startIcon={formSaving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : undefined}
            sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}>
            {formSaving ? 'Saving…' : editingId ? 'Update' : 'Create Promotion'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete / Retire Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>
          {deleteTarget && deleteTarget.appliedCount > 0 ? 'Retire Promotion?' : 'Delete Promotion?'}
        </DialogTitle>
        <DialogContent>
          {deleteTarget && deleteTarget.appliedCount > 0 ? (
            <Typography variant="body2" color="text.secondary">
              <strong>{deleteTarget.name}</strong> has been applied to {deleteTarget.appliedCount} rental{deleteTarget.appliedCount !== 1 ? 's' : ''}.
              It will be retired (removed from available promotions but kept on active rentals).
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              <strong>{deleteTarget?.name}</strong> will be permanently deleted.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" color={deleteTarget?.appliedCount ? 'warning' : 'error'} onClick={handleDelete}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            {deleteTarget?.appliedCount ? 'Retire' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnack(null)} severity="success" variant="filled"
          sx={{ bgcolor: '#B8914A', color: 'white', fontWeight: 500, '& .MuiAlert-icon': { color: 'white' } }}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ── Promo Card Component ─────────────────────────────────────────────────────

function PromoCard({ promo, onEdit, onDelete, retired }: { promo: Promotion; onEdit: () => void; onDelete?: () => void; retired?: boolean }) {
  const mc = METHOD_CONFIG[promo.method]
  const discountLabel = promo.discountType === 'percentage'
    ? `${promo.discountValue.toFixed(2)}%`
    : `$${(promo.discountValue / 100).toFixed(2)}`

  return (
    <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, opacity: retired ? 0.6 : 1 }}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        {/* Top row: name + actions */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#1C0F06' }}>{promo.name}</Typography>
              {retired && <Chip label="Retired" size="small" sx={{ bgcolor: '#F3F4F6', color: '#6B7280', fontWeight: 500, fontSize: '0.7rem' }} />}
            </Box>
            {promo.description && (
              <Typography variant="body2" color="text.secondary">{promo.description}</Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
            <Tooltip title="Edit"><IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton></Tooltip>
            {onDelete && (
              <Tooltip title={promo.appliedCount > 0 ? 'Retire' : 'Delete'}>
                <IconButton size="small" onClick={onDelete}>
                  {promo.appliedCount > 0
                    ? <ArchiveIcon fontSize="small" sx={{ color: '#F59E0B' }} />
                    : <DeleteOutlineIcon fontSize="small" sx={{ color: '#EF4444' }} />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Info grid */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {/* Method */}
          <InfoItem label="Method">
            <Chip icon={<Box sx={{ display: 'flex', color: mc.color }}>{mc.icon}</Box>}
              label={mc.label} size="small"
              sx={{ bgcolor: mc.bg, color: mc.color, fontWeight: 600, fontSize: '0.75rem', '& .MuiChip-icon': { color: 'inherit' } }} />
          </InfoItem>

          {/* Discount */}
          <InfoItem label="Discount">
            <Typography variant="body2" fontWeight={700} sx={{ color: '#065F46', fontSize: '1rem' }}>{discountLabel}</Typography>
          </InfoItem>

          {/* Unit Types */}
          <InfoItem label="Unit Types">
            {promo.allUnitTypes ? (
              <Typography variant="body2">All Unit Types</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {promo.unitTypes.map((ut) => (
                  <Chip key={ut} label={ut} size="small" sx={{ fontSize: '0.7rem', height: 22, bgcolor: '#F3F4F6' }} />
                ))}
              </Box>
            )}
          </InfoItem>

          {/* Dates */}
          <InfoItem label="Start">{fmtDate(promo.startDate)}</InfoItem>
          <InfoItem label="End">{promo.endDate ? fmtDate(promo.endDate) : 'Not Set'}</InfoItem>

          {/* Timing */}
          <InfoItem label="Begins">{promo.beginsImmediately ? 'Immediately' : `After ${promo.beginsAfterCycles} cycle(s)`}</InfoItem>
          <InfoItem label="Duration">
            {promo.noExpiration ? 'No expiration' : `${promo.durationCycles} billing cycle(s)`}
          </InfoItem>
        </Box>

        {promo.method === 'promo_code' && promo.promoCode && (
          <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #EDE5D8', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">Promo Code:</Typography>
            <Chip label={promo.promoCode} size="small"
              sx={{ fontFamily: 'monospace', fontWeight: 700, bgcolor: '#EDE9FE', color: '#7C3AED', letterSpacing: '0.05em' }} />
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 100 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, fontWeight: 500, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
      {typeof children === 'string'
        ? <Typography variant="body2">{children}</Typography>
        : children}
    </Box>
  )
}
