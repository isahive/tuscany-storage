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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ArchiveIcon from '@mui/icons-material/Archive'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'

// ── Types ────────────────────────────────────────────────────────────────────

interface ProtectionPlan {
  _id: string
  name: string
  coverageAmount: number
  monthlyPrice: number
  description: string
  displayOrder: number
  status: 'active' | 'retired'
  appliedCount: number
}

interface FormState {
  name: string
  coverageAmount: string
  monthlyPrice: string
  description: string
  displayOrder: string
}

const EMPTY_FORM: FormState = {
  name: '',
  coverageAmount: '',
  monthlyPrice: '',
  description: '',
  displayOrder: '0',
}

const inputSx = { '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#E5E7EB' }, '&:hover fieldset': { borderColor: '#B8914A' }, '&.Mui-focused fieldset': { borderColor: '#B8914A' } } }

const fmtMoney = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProtectionPlansPage() {
  const [plans, setPlans] = useState<ProtectionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snack, setSnack] = useState<string | null>(null)

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ProtectionPlan | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadPlans = useCallback(() => {
    fetch('/api/protection-plans')
      .then((r) => r.json())
      .then((json) => { if (json.success) setPlans(json.data) })
      .catch(() => setError('Failed to load protection plans'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadPlans() }, [loadPlans])

  // ── Dialog ───────────────────────────────────────────────────────────────

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(p: ProtectionPlan) {
    setEditingId(p._id)
    setForm({
      name: p.name,
      coverageAmount: String(p.coverageAmount / 100),
      monthlyPrice: String(p.monthlyPrice / 100),
      description: p.description,
      displayOrder: String(p.displayOrder),
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Name is required'); return }
    const coverage = Math.round((parseFloat(form.coverageAmount) || 0) * 100)
    const price = Math.round((parseFloat(form.monthlyPrice) || 0) * 100)
    const order = parseInt(form.displayOrder, 10)
    if (coverage <= 0) { setFormError('Coverage amount must be greater than zero'); return }
    if (price < 0) { setFormError('Monthly price cannot be negative'); return }
    if (!Number.isInteger(order)) { setFormError('Display order must be an integer'); return }

    setFormSaving(true); setFormError(null)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        coverageAmount: coverage,
        monthlyPrice: price,
        description: form.description.trim(),
        displayOrder: order,
      }

      if (editingId) body.id = editingId

      const res = await fetch('/api/protection-plans', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Save failed')

      setDialogOpen(false)
      setSnack(editingId ? 'Protection plan updated' : 'Protection plan created')
      loadPlans()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setFormSaving(false) }
  }

  // ── Delete / Retire ──────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/protection-plans?id=${deleteTarget._id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Delete failed')
      setSnack(json.retired ? 'Plan retired (already applied to leases)' : 'Plan deleted')
      loadPlans()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally { setDeleteTarget(null) }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  const activePlans = plans.filter((p) => p.status === 'active')
  const retiredPlans = plans.filter((p) => p.status === 'retired')

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button component={Link} href="/admin/settings" startIcon={<ArrowBackIcon />}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, '&:hover': { color: '#B8914A', bgcolor: 'transparent' }, px: 0, minWidth: 0 }}>
          Setup
        </Button>
        <Typography variant="h5" sx={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 700, color: '#2C3826', flex: 1 }}>
          Protection Plans
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}
          sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600, px: 2.5 }}>
          New Plan
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Protection plans are coverage tiers tenants can choose during the rental process. Each plan defines a coverage amount and a monthly price.
        Plans applied to at least one lease can be retired but not deleted.
      </Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}

      {/* Active Plans */}
      {activePlans.length === 0 && retiredPlans.length === 0 ? (
        <Card sx={{ border: '1px solid #E5E7EB', boxShadow: 'none', borderRadius: 2 }}>
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <ShieldOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif', mb: 1 }}>No Protection Plans Yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Create your first protection plan to start offering coverage tiers to tenants.</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}
              sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}>
              Create Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {activePlans.map((p) => <PlanCard key={p._id} plan={p} onEdit={() => openEdit(p)} onDelete={() => setDeleteTarget(p)} />)}

          {retiredPlans.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ArchiveIcon sx={{ fontSize: 16 }} /> Retired Plans
              </Typography>
              {retiredPlans.map((p) => <PlanCard key={p._id} plan={p} onEdit={() => openEdit(p)} retired />)}
            </>
          )}
        </Box>
      )}

      {/* ── Create / Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle sx={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 700 }}>
          {editingId ? 'Edit Protection Plan' : 'New Protection Plan'}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            <TextField label="Plan Name" fullWidth size="small" value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. $2,000 Coverage"
              sx={inputSx} />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Coverage Amount" type="number" size="small" fullWidth
                value={form.coverageAmount}
                onChange={(e) => set('coverageAmount', e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                sx={inputSx} />
              <TextField label="Monthly Price" type="number" size="small" fullWidth
                value={form.monthlyPrice}
                onChange={(e) => set('monthlyPrice', e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                sx={inputSx} />
            </Box>

            <TextField label="Description" fullWidth size="small" multiline rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What does this plan cover? Visible to tenants when selecting a plan."
              sx={inputSx} />

            <TextField label="Display Order" type="number" size="small"
              value={form.displayOrder}
              onChange={(e) => set('displayOrder', e.target.value)}
              inputProps={{ step: 1 }}
              helperText="Lower numbers appear first in the dropdown"
              sx={{ width: 200, ...inputSx }} />
          </Box>

          {formError && <Alert severity="error" sx={{ mt: 2, borderRadius: 1 }}>{formError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={formSaving}
            startIcon={formSaving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : undefined}
            sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}>
            {formSaving ? 'Saving…' : editingId ? 'Update' : 'Create Plan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete / Retire Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif' }}>
          {deleteTarget && deleteTarget.appliedCount > 0 ? 'Retire Protection Plan?' : 'Delete Protection Plan?'}
        </DialogTitle>
        <DialogContent>
          {deleteTarget && deleteTarget.appliedCount > 0 ? (
            <Typography variant="body2" color="text.secondary">
              <strong>{deleteTarget.name}</strong> is currently used on {deleteTarget.appliedCount} lease{deleteTarget.appliedCount !== 1 ? 's' : ''}.
              It will be retired (removed from available plans but kept on active leases).
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

// ── Plan Card Component ──────────────────────────────────────────────────────

function PlanCard({ plan, onEdit, onDelete, retired }: { plan: ProtectionPlan; onEdit: () => void; onDelete?: () => void; retired?: boolean }) {
  return (
    <Card sx={{ border: '1px solid #E5E7EB', boxShadow: 'none', borderRadius: 2, opacity: retired ? 0.6 : 1 }}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        {/* Top row: name + actions */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#FAF6EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldOutlinedIcon sx={{ color: '#B8914A', fontSize: 22 }} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#2C3826' }}>{plan.name}</Typography>
                {retired && <Chip label="Retired" size="small" sx={{ bgcolor: '#F3F4F6', color: '#6B7280', fontWeight: 500, fontSize: '0.7rem' }} />}
              </Box>
              {plan.description && (
                <Typography variant="body2" color="text.secondary">{plan.description}</Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
            <Tooltip title="Edit"><IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton></Tooltip>
            {onDelete && (
              <Tooltip title={plan.appliedCount > 0 ? 'Retire' : 'Delete'}>
                <IconButton size="small" onClick={onDelete}>
                  {plan.appliedCount > 0
                    ? <ArchiveIcon fontSize="small" sx={{ color: '#F59E0B' }} />
                    : <DeleteOutlineIcon fontSize="small" sx={{ color: '#EF4444' }} />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Info grid */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          <InfoItem label="Coverage">
            <Typography variant="body2" fontWeight={700} sx={{ color: '#2C3826', fontSize: '1rem' }}>{fmtMoney(plan.coverageAmount)}</Typography>
          </InfoItem>
          <InfoItem label="Monthly Price">
            <Typography variant="body2" fontWeight={700} sx={{ color: '#065F46', fontSize: '1rem' }}>{fmtMoney(plan.monthlyPrice)}</Typography>
          </InfoItem>
          <InfoItem label="Display Order">{String(plan.displayOrder)}</InfoItem>
          <InfoItem label="Applied To">
            {plan.appliedCount} lease{plan.appliedCount !== 1 ? 's' : ''}
          </InfoItem>
        </Box>
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
