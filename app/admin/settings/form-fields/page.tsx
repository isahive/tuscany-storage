'use client'

import { useState, useEffect, useCallback } from 'react'
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
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import DeleteIcon from '@mui/icons-material/Delete'
import { useRouter } from 'next/navigation'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'

// ── Types ───────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'select' | 'checkbox'

interface FormField {
  key: string
  label: string
  showOnSignup: boolean
  requiredOnSignup: boolean
  showOnWaitingList: boolean
  requiredOnWaitingList: boolean
  isCustom: boolean
  order: number
  fieldType?: FieldType
  options?: string[]
  helpText?: string
}

const TYPE_CHIP_STYLES: Record<FieldType, { bg: string; color: string; label: string }> = {
  text:     { bg: '#FAF7F2', color: '#7A5B2E', label: 'Text' },
  select:   { bg: '#EFE7DA', color: '#5C3F11', label: 'Dropdown' },
  checkbox: { bg: '#E8F1EE', color: '#1F6E5C', label: 'Checkbox' },
}

function FieldTypeChip({ type }: { type?: FieldType }) {
  const t: FieldType = type ?? 'text'
  const s = TYPE_CHIP_STYLES[t]
  return (
    <Chip
      size="small"
      label={s.label}
      sx={{
        bgcolor: s.bg,
        color: s.color,
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 20,
        border: '1px solid #E5E7EB',
      }}
    />
  )
}

// ── Edit Field Dialog ───────────────────────────────────────────────────────

function EditFieldDialog({ open, onClose, field, onSave }: {
  open: boolean; onClose: () => void; field: FormField | null
  onSave: (updated: FormField) => void
}) {
  const [form, setForm] = useState<FormField | null>(null)
  const [optionsText, setOptionsText] = useState('')

  useEffect(() => {
    if (field) {
      setForm({ ...field, fieldType: field.fieldType ?? 'text', options: field.options ?? [], helpText: field.helpText ?? '' })
      setOptionsText((field.options ?? []).join('\n'))
    }
  }, [field])

  if (!form) return null

  const isCheckbox = form.fieldType === 'checkbox'
  const isSelect = form.fieldType === 'select'

  function commit() {
    if (!form) return
    const opts = isSelect
      ? optionsText.split('\n').map((l) => l.trim()).filter(Boolean)
      : []
    onSave({ ...form, options: opts, helpText: form.helpText ?? '' })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Edit Field — {form.label}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {/* Field type — locked for built-in fields */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }} disabled={!form.isCustom}>
            <InputLabel>Field type</InputLabel>
            <Select
              label="Field type"
              value={form.fieldType ?? 'text'}
              onChange={(e) => setForm({ ...form, fieldType: e.target.value as FieldType })}
            >
              <MenuItem value="text">Text</MenuItem>
              <MenuItem value="select">Dropdown</MenuItem>
              <MenuItem value="checkbox">Checkbox</MenuItem>
            </Select>
          </FormControl>
          {!form.isCustom && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: -1.5, mb: 1.5 }}>
              Built-in field type cannot be changed.
            </Typography>
          )}

          {/* Options (select only) */}
          {isSelect && (
            <TextField
              label="Options"
              fullWidth
              multiline
              minRows={3}
              size="small"
              helperText="One option per line"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              sx={{ mb: 2 }}
            />
          )}

          {/* Help text */}
          <TextField
            label="Help text"
            fullWidth
            size="small"
            multiline
            minRows={2}
            helperText="Optional hint shown under the field"
            value={form.helpText ?? ''}
            onChange={(e) => setForm({ ...form, helpText: e.target.value })}
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 1.5, borderColor: '#E5E7EB' }} />

          <FormControlLabel
            control={<Checkbox checked={form.showOnSignup} onChange={(e) => setForm({ ...form, showOnSignup: e.target.checked })} />}
            label="Show on signup"
          />
          {!isCheckbox && (
            <Box sx={{ ml: 4 }}>
              <FormControlLabel
                control={<Checkbox checked={form.requiredOnSignup} onChange={(e) => setForm({ ...form, requiredOnSignup: e.target.checked })} disabled={!form.showOnSignup} />}
                label="Required"
              />
            </Box>
          )}
          <Divider sx={{ my: 1.5, borderColor: '#E5E7EB' }} />
          <FormControlLabel
            control={<Checkbox checked={form.showOnWaitingList} onChange={(e) => setForm({ ...form, showOnWaitingList: e.target.checked })} />}
            label="Show on waiting list"
          />
          {!isCheckbox && (
            <Box sx={{ ml: 4 }}>
              <FormControlLabel
                control={<Checkbox checked={form.requiredOnWaitingList} onChange={(e) => setForm({ ...form, requiredOnWaitingList: e.target.checked })} disabled={!form.showOnWaitingList} />}
                label="Required on waiting list"
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" disableElevation onClick={commit}
          sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#A07F3F' } }}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function FormFieldSettingsPage() {
  const router = useRouter()
  const [fields, setFields] = useState<FormField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editField, setEditField] = useState<FormField | null>(null)

  // Custom field creation
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [newOptionsText, setNewOptionsText] = useState('')
  const [newHelpText, setNewHelpText] = useState('')
  const [newShowSignup, setNewShowSignup] = useState(true)
  const [newRequiredSignup, setNewRequiredSignup] = useState(false)
  const [newShowWaiting, setNewShowWaiting] = useState(false)
  const [newRequiredWaiting, setNewRequiredWaiting] = useState(false)

  const loadFields = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      const json = await res.json()
      if (!json.success) return

      const saved = json.data?.customerFormFields
      if (saved && saved.length > 0) {
        setFields(saved.sort((a: FormField, b: FormField) => a.order - b.order))
      } else {
        setFields([...DEFAULT_SETTINGS.customerFormFields])
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadFields() }, [loadFields])

  const defaultFields = fields.filter((f) => !f.isCustom)
  const customFields = fields.filter((f) => f.isCustom)

  function handleEditSave(updated: FormField) {
    setFields((prev) => prev.map((f) => f.key === updated.key ? updated : f))
  }

  function handleDeleteCustom(key: string) {
    setFields((prev) => prev.filter((f) => f.key !== key))
  }

  function handleCreateCustomField() {
    if (!newFieldName.trim()) return
    const key = 'custom_' + newFieldName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now()
    const opts = newFieldType === 'select'
      ? newOptionsText.split('\n').map((l) => l.trim()).filter(Boolean)
      : []
    const newField: FormField = {
      key,
      label: newFieldName.trim(),
      showOnSignup: newShowSignup,
      requiredOnSignup: newRequiredSignup,
      showOnWaitingList: newShowWaiting,
      requiredOnWaitingList: newRequiredWaiting,
      isCustom: true,
      order: fields.length,
      fieldType: newFieldType,
      options: opts,
      helpText: newHelpText,
    }
    setFields((prev) => [...prev, newField])
    setNewFieldName('')
    setNewFieldType('text')
    setNewOptionsText('')
    setNewHelpText('')
    setNewShowSignup(true)
    setNewRequiredSignup(false)
    setNewShowWaiting(false)
    setNewRequiredWaiting(false)
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      // Re-index order
      const ordered = fields.map((f, i) => ({ ...f, order: i }))
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerFormFields: ordered }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to save')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSaving(false) }
  }

  function renderYesNo(val: boolean) {
    return (
      <Typography variant="body2" sx={{ color: val ? '#065F46' : 'text.secondary', fontWeight: val ? 600 : 400 }}>
        {val ? 'Yes' : 'No'}
      </Typography>
    )
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}><CircularProgress /></Box>
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <IconButton aria-label="Back to settings" onClick={() => router.push('/admin/settings')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: '#B8914A', fontFamily: 'var(--font-outfit), system-ui, sans-serif' }}
        >
          Form Field Settings for Customers
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, ml: 7 }}>
        This page allows you to manage which fields are shown and required when a new customer is registering an account,
        being added to the waiting list, or when an existing customer is editing their profile information.
        Customer-required fields are only marked (*) for managers, not actually required.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Defaults table ──────────────────────────────────────────── */}
      <Typography variant="h6" sx={{ color: '#B8914A', fontWeight: 700, mb: 1 }}>
        Defaults
      </Typography>

      <Card sx={{ mb: 4, border: '1px solid #E5E7EB' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' } }}>
                <TableCell sx={{ minWidth: 280 }}>Field Name</TableCell>
                <TableCell width={110}>Type</TableCell>
                <TableCell align="center">Show on signup</TableCell>
                <TableCell align="center">Required on signup</TableCell>
                <TableCell align="center">Show on waiting list</TableCell>
                <TableCell align="center">Required on waiting list</TableCell>
                <TableCell align="right" width={60}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {defaultFields.map((f) => (
                <TableRow key={f.key} sx={{ '&:hover': { bgcolor: '#FAF7F2' }, '& td': { borderColor: '#E5E7EB' } }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{f.label}</Typography>
                    {f.helpText && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {f.helpText.length > 80 ? f.helpText.slice(0, 80) + '…' : f.helpText}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><FieldTypeChip type={f.fieldType} /></TableCell>
                  <TableCell align="center">{renderYesNo(f.showOnSignup)}</TableCell>
                  <TableCell align="center">{renderYesNo(f.requiredOnSignup)}</TableCell>
                  <TableCell align="center">{renderYesNo(f.showOnWaitingList)}</TableCell>
                  <TableCell align="center">{renderYesNo(f.requiredOnWaitingList)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" sx={{ textTransform: 'none', color: '#B8914A', fontWeight: 500 }}
                      onClick={() => setEditField(f)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* ── Custom fields table ──────────────────────────────────────── */}
      <Typography variant="h6" sx={{ color: '#B8914A', fontWeight: 700, mb: 0.5 }}>
        Custom
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Drag and drop to reorder
      </Typography>

      <Card sx={{ mb: 3, border: '1px solid #E5E7EB' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' } }}>
                <TableCell sx={{ minWidth: 280 }}>Field Name</TableCell>
                <TableCell width={110}>Type</TableCell>
                <TableCell align="center">Show on signup</TableCell>
                <TableCell align="center">Required on signup</TableCell>
                <TableCell align="center">Show on waiting list</TableCell>
                <TableCell align="center">Required on waiting list</TableCell>
                <TableCell align="right" width={100}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customFields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
                      No custom fields yet
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                customFields.map((f) => (
                  <TableRow key={f.key} sx={{ '&:hover': { bgcolor: '#FAF7F2' }, '& td': { borderColor: '#E5E7EB' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DragIndicatorIcon sx={{ fontSize: 18, color: 'text.disabled', cursor: 'grab' }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{f.label}</Typography>
                          {f.helpText && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              {f.helpText.length > 80 ? f.helpText.slice(0, 80) + '…' : f.helpText}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><FieldTypeChip type={f.fieldType} /></TableCell>
                    <TableCell align="center">{renderYesNo(f.showOnSignup)}</TableCell>
                    <TableCell align="center">{renderYesNo(f.requiredOnSignup)}</TableCell>
                    <TableCell align="center">{renderYesNo(f.showOnWaitingList)}</TableCell>
                    <TableCell align="center">{renderYesNo(f.requiredOnWaitingList)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Button size="small" sx={{ textTransform: 'none', color: '#B8914A', fontWeight: 500 }}
                          onClick={() => setEditField(f)}>
                          Edit
                        </Button>
                        <Tooltip title="Delete">
                          <IconButton size="small" aria-label="Delete custom field" sx={{ color: '#DC2626' }} onClick={() => handleDeleteCustom(f.key)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Save button for order/changes */}
      <Button variant="contained" disableElevation onClick={handleSave} disabled={saving}
        sx={{ mb: 4, bgcolor: '#B8914A', '&:hover': { bgcolor: '#A07F3F' } }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>

      {/* ── Create Custom Field ──────────────────────────────────────── */}
      <Card sx={{ maxWidth: 560, mb: 4, border: '1px solid #E5E7EB' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, bgcolor: '#2C3826', color: 'white', mx: -3, mt: -3, px: 3, py: 1.2, borderRadius: '4px 4px 0 0' }}>
            Create Custom Field
          </Typography>

          <TextField label="Name" fullWidth size="small" value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)} sx={{ mb: 2 }} />

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Field type</InputLabel>
            <Select
              label="Field type"
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as FieldType)}
            >
              <MenuItem value="text">Text</MenuItem>
              <MenuItem value="select">Dropdown</MenuItem>
              <MenuItem value="checkbox">Checkbox</MenuItem>
            </Select>
          </FormControl>

          {newFieldType === 'select' && (
            <TextField
              label="Options"
              fullWidth
              multiline
              minRows={3}
              size="small"
              helperText="One option per line"
              value={newOptionsText}
              onChange={(e) => setNewOptionsText(e.target.value)}
              sx={{ mb: 2 }}
            />
          )}

          <TextField
            label="Help text"
            fullWidth
            size="small"
            multiline
            minRows={2}
            helperText="Optional hint shown under the field"
            value={newHelpText}
            onChange={(e) => setNewHelpText(e.target.value)}
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={<Checkbox checked={newShowSignup} onChange={(e) => setNewShowSignup(e.target.checked)} size="small" />}
            label={<Typography variant="body2">Show on signup</Typography>}
          />
          {newFieldType !== 'checkbox' && (
            <Box sx={{ ml: 4 }}>
              <FormControlLabel
                control={<Checkbox checked={newRequiredSignup} onChange={(e) => setNewRequiredSignup(e.target.checked)} size="small" disabled={!newShowSignup} />}
                label={<Typography variant="body2">Required</Typography>}
              />
            </Box>
          )}

          <FormControlLabel
            control={<Checkbox checked={newShowWaiting} onChange={(e) => setNewShowWaiting(e.target.checked)} size="small" />}
            label={<Typography variant="body2">Show on waiting list</Typography>}
          />
          {newFieldType !== 'checkbox' && (
            <Box sx={{ ml: 4 }}>
              <FormControlLabel
                control={<Checkbox checked={newRequiredWaiting} onChange={(e) => setNewRequiredWaiting(e.target.checked)} size="small" disabled={!newShowWaiting} />}
                label={<Typography variant="body2">Required on waiting list</Typography>}
              />
            </Box>
          )}

          <Button variant="contained" disableElevation size="small" onClick={handleCreateCustomField}
            disabled={!newFieldName.trim()}
            sx={{ mt: 2, bgcolor: '#B8914A', '&:hover': { bgcolor: '#A07F3F' } }}>
            Create Custom Field
          </Button>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <EditFieldDialog
        open={!!editField}
        onClose={() => setEditField(null)}
        field={editField}
        onSave={handleEditSave}
      />

      <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)}
        message="Form field settings saved" />
    </Box>
  )
}
