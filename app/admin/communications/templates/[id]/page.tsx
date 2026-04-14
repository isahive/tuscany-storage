'use client'

import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useParams, useRouter } from 'next/navigation'
import SaveIcon from '@mui/icons-material/Save'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

const RULES = ['Manual', 'Late', 'Pre-Lien', 'Lien', 'Auction']

const PLACEHOLDERS = [
  '[[DATE]]',
  '[[CUSTOMER_NAME]]',
  '[[CUSTOMER_EMAIL]]',
  '[[CUSTOMER_PHONE]]',
  '[[BALANCE]]',
  '[[PAST_DUE_LINE_ITEMS]]',
  '[[UNIT_NUMBER]]',
  '[[UNIT_SIZE]]',
  '[[MONTHLY_RATE]]',
  '[[FACILITY_NAME]]',
  '[[FACILITY_ADDRESS]]',
  '[[FACILITY_CITY]]',
  '[[FACILITY_STATE]]',
  '[[FACILITY_ZIP]]',
  '[[FACILITY_PHONE]]',
  '[[FACILITY_URL]]',
]

interface TemplateForm {
  name: string
  type: 'default' | 'custom'
  description: string
  emailSubject: string
  emailBody: string
  textBody: string
  channels: {
    email: boolean
    text: boolean
    print: boolean
  }
  rule: string
  daysPastDue: number | ''
}

const EMPTY_FORM: TemplateForm = {
  name: '',
  type: 'custom',
  description: '',
  emailSubject: '',
  emailBody: '',
  textBody: '',
  channels: { email: true, text: false, print: false },
  rule: 'Manual',
  daysPastDue: '',
}

export default function TemplateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const isNew = id === 'new'

  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!isNew) {
      fetchTemplate()
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchTemplate() {
    try {
      const res = await fetch(`/api/admin/templates/${id}`)
      if (!res.ok) throw new Error('Template not found')
      const data = await res.json()
      setForm({
        name: data.name || '',
        type: data.type || 'custom',
        description: data.description || '',
        emailSubject: data.emailSubject || '',
        emailBody: data.emailBody || '',
        textBody: data.textBody || '',
        channels: data.channels || { email: true, text: false, print: false },
        rule: data.rule || 'Manual',
        daysPastDue: data.daysPastDue ?? '',
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  function updateField<K extends keyof TemplateForm>(field: K, value: TemplateForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function updateChannel(channel: 'email' | 'text' | 'print', value: boolean) {
    setForm((prev) => ({
      ...prev,
      channels: { ...prev.channels, [channel]: value },
    }))
  }

  async function handleSave() {
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const url = isNew ? '/api/admin/templates' : `/api/admin/templates/${id}`
      const method = isNew ? 'POST' : 'PUT'
      const body = {
        ...form,
        daysPastDue: form.daysPastDue === '' ? null : Number(form.daysPastDue),
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save template')
      }
      setSuccess('Template saved successfully.')
      if (isNew) {
        const data = await res.json()
        router.replace(`/admin/communications/templates/${data._id}`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/admin/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete template')
      router.push('/admin/communications/templates')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  const isDefault = form.type === 'default'

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/admin/communications/templates')}
          sx={{ color: '#B8914A', textTransform: 'none' }}
        >
          Back to Templates
        </Button>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: '#1C0F06',
              fontFamily: '"Playfair Display", serif',
            }}
          >
            {isNew ? 'Create Template' : 'Edit Template'}
          </Typography>
          {isDefault && (
            <Chip
              label="Default"
              size="small"
              sx={{
                bgcolor: '#FAF7F2',
                color: '#B8914A',
                fontWeight: 600,
                border: '1px solid #EDE5D8',
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!isNew && !isDefault && (
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              sx={{
                color: '#d32f2f',
                borderColor: '#d32f2f',
                textTransform: 'none',
                '&:hover': { borderColor: '#b71c1c', bgcolor: '#fff5f5' },
              }}
            >
              Delete
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{
              bgcolor: '#B8914A',
              '&:hover': { bgcolor: '#A5653A' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Form */}
      <Paper sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          {/* Name */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Template Name"
              fullWidth
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              size="small"
            />
          </Grid>

          {/* Description */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Description"
              fullWidth
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              size="small"
            />
          </Grid>

          {/* Rule */}
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Rule</InputLabel>
              <Select
                value={form.rule}
                label="Rule"
                onChange={(e) => updateField('rule', e.target.value)}
              >
                {RULES.map((r) => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Days Past Due */}
          {form.rule !== 'Manual' && (
            <Grid item xs={12} sm={4}>
              <TextField
                label="Days Past Due"
                type="number"
                fullWidth
                size="small"
                value={form.daysPastDue}
                onChange={(e) => updateField('daysPastDue', e.target.value === '' ? '' : Number(e.target.value))}
                inputProps={{ min: 0 }}
              />
            </Grid>
          )}

          {/* Channels */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#1C0F06' }}>
              Channels
            </Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.channels.email}
                    onChange={(e) => updateChannel('email', e.target.checked)}
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#B8914A' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#B8914A' } }}
                  />
                }
                label="Email"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.channels.text}
                    onChange={(e) => updateChannel('text', e.target.checked)}
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#B8914A' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#B8914A' } }}
                  />
                }
                label="Text"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.channels.print}
                    onChange={(e) => updateChannel('print', e.target.checked)}
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#B8914A' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#B8914A' } }}
                  />
                }
                label="Print"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Email Content */}
      <Paper sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1C0F06', mb: 2 }}>
          Email / Letter Content
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              label="Email Subject"
              fullWidth
              value={form.emailSubject}
              onChange={(e) => updateField('emailSubject', e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Email / Letter Body"
              fullWidth
              multiline
              minRows={12}
              value={form.emailBody}
              onChange={(e) => updateField('emailBody', e.target.value)}
              placeholder="Enter the email or letter content here. Use placeholders like [[CUSTOMER_NAME]] for dynamic content."
              InputProps={{
                sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Text Message Content */}
      <Paper sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1C0F06', mb: 2 }}>
          Text Message Content
        </Typography>
        <TextField
          label="Text Message"
          fullWidth
          multiline
          minRows={3}
          value={form.textBody}
          onChange={(e) => updateField('textBody', e.target.value)}
          placeholder="Enter the SMS text message content. Keep it concise (160 characters recommended)."
          helperText={`${form.textBody.length} characters`}
        />
      </Paper>

      {/* Available Placeholders */}
      <Paper sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, p: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1C0F06', mb: 2 }}>
          Available Placeholders
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Click a placeholder to copy it to your clipboard. Paste it into the email body or text message fields above.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {PLACEHOLDERS.map((p) => (
            <Chip
              key={p}
              label={p}
              size="small"
              onClick={() => navigator.clipboard.writeText(p)}
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                bgcolor: '#FAF7F2',
                border: '1px solid #EDE5D8',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#EDE5D8', borderColor: '#B8914A' },
              }}
            />
          ))}
        </Box>
      </Paper>
    </Box>
  )
}
