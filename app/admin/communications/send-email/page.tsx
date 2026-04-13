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
  FormControl,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import DeselectIcon from '@mui/icons-material/Deselect'
import EmailIcon from '@mui/icons-material/Email'
import type { TenantStatus } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  status: TenantStatus
  unit: string
}

interface Template {
  _id: string
  name: string
  subject: string
  body: string
}

type CustomerFilter = 'all' | 'active' | 'delinquent' | 'locked_out'

const FILTER_LABELS: Record<CustomerFilter, string> = {
  all: 'All Customers',
  active: 'Active',
  delinquent: 'Delinquent',
  locked_out: 'Locked Out',
}

const STATUS_COLORS: Record<TenantStatus, { bg: string; color: string }> = {
  active: { bg: '#D1FAE5', color: '#065F46' },
  delinquent: { bg: '#FEF3C7', color: '#92400E' },
  locked_out: { bg: '#FEE2E2', color: '#991B1B' },
  moved_out: { bg: '#F3F4F6', color: '#374151' },
}

const STATUS_LABELS: Record<TenantStatus, string> = {
  active: 'Active',
  delinquent: 'Delinquent',
  locked_out: 'Locked Out',
  moved_out: 'Moved Out',
}

// ── Shared styles ────────────────────────────────────────────────────────────

const sectionHeaderSx = {
  bgcolor: '#1C0F06',
  color: 'white',
  px: 2.5,
  py: 1.5,
  borderRadius: '8px 8px 0 0',
  fontWeight: 600,
  fontSize: '0.875rem',
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: '#EDE5D8' },
    '&:hover fieldset': { borderColor: '#B8914A' },
    '&.Mui-focused fieldset': { borderColor: '#B8914A' },
  },
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SendEmailPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  // Send state
  const [sending, setSending] = useState(false)
  const [sendProgress, setSendProgress] = useState(0)
  const [successOpen, setSuccessOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Load tenants ─────────────────────────────────────────────────────────

  const fetchTenants = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (customerFilter !== 'all') params.set('status', customerFilter)
      const res = await fetch(`/api/tenants?${params}`)
      const json = await res.json()
      if (!json.success) return

      // Fetch leases for unit mapping
      const leaseRes = await fetch('/api/leases?limit=500')
      const leaseJson = await leaseRes.json()
      const leases = leaseJson.success ? leaseJson.data?.items ?? [] : []

      const tenantLeaseMap = new Map<string, string>()
      for (const l of leases) {
        if (l.status === 'ended') continue
        const tid = typeof l.tenantId === 'object' ? l.tenantId._id : l.tenantId
        const unitNum = typeof l.unitId === 'object' ? l.unitId.unitNumber : ''
        tenantLeaseMap.set(tid, unitNum)
      }

      const mapped: TenantRow[] = (json.data?.items ?? []).map(
        (t: Record<string, unknown>) => ({
          id: t._id as string,
          firstName: t.firstName as string,
          lastName: t.lastName as string,
          email: t.email as string,
          phone: t.phone as string,
          status: t.status as TenantStatus,
          unit: tenantLeaseMap.get(t._id as string) ?? '',
        })
      )
      setTenants(mapped)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [customerFilter])

  useEffect(() => {
    setLoading(true)
    fetchTenants()
  }, [fetchTenants])

  // ── Load templates ───────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/admin/templates')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setTemplates(json.data ?? [])
      })
      .catch(() => {})
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAddAll() {
    setSelectedIds(new Set(tenants.map((t) => t.id)))
  }

  function handleRemoveAll() {
    setSelectedIds(new Set())
  }

  function handleLoadTemplate() {
    const tmpl = templates.find((t) => t._id === templateId)
    if (tmpl) {
      setSubject(tmpl.subject)
      setBody(tmpl.body)
    }
  }

  async function handleSend() {
    if (selectedIds.size === 0) {
      setError('Please select at least one customer.')
      return
    }
    if (!subject.trim()) {
      setError('Subject is required.')
      return
    }

    setSending(true)
    setError(null)
    setSendProgress(10)

    try {
      const payload: Record<string, unknown> = {
        tenantIds: Array.from(selectedIds),
        subject,
        html: body,
      }
      if (templateId) payload.templateId = templateId

      setSendProgress(40)

      const res = await fetch('/api/admin/email-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      setSendProgress(90)

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to send emails')
      }

      setSendProgress(100)
      setSuccessOpen(true)
      setSelectedIds(new Set())
      setSubject('')
      setBody('')
      setTemplateId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send emails')
    } finally {
      setSending(false)
      setSendProgress(0)
    }
  }

  // ── Filter tenants based on selection ────────────────────────────────────

  const filteredTenants = tenants.filter(
    (t) => t.status !== 'moved_out'
  )

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
          flexWrap: 'wrap',
        }}
      >
        <Button
          component={Link}
          href="/admin/communications"
          startIcon={<ArrowBackIcon />}
          sx={{
            color: 'text.secondary',
            textTransform: 'none',
            fontWeight: 500,
            '&:hover': { color: '#B8914A', bgcolor: 'transparent' },
            px: 0,
            minWidth: 0,
          }}
        >
          Communications
        </Button>
        <Typography
          variant="h5"
          sx={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 700,
            color: '#1C0F06',
            flex: 1,
          }}
        >
          Send Email
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mb: 2.5, borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      {sending && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={sendProgress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: '#EDE5D8',
              '& .MuiLinearProgress-bar': { bgcolor: '#B8914A' },
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}
          >
            Sending emails... {sendProgress}%
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Left column: Customer selection */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
            <Box sx={sectionHeaderSx}>Filter &amp; Select Customers</Box>
            <CardContent sx={{ p: 2.5 }}>
              {/* Filter */}
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Filter Customers</InputLabel>
                <Select
                  label="Filter Customers"
                  value={customerFilter}
                  onChange={(e) => {
                    setCustomerFilter(e.target.value as CustomerFilter)
                    setSelectedIds(new Set())
                  }}
                >
                  {Object.entries(FILTER_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Add All / Remove All */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  {selectedIds.size} of {filteredTenants.length} selected
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<SelectAllIcon />}
                    onClick={handleAddAll}
                    sx={{ textTransform: 'none', color: '#B8914A', fontWeight: 600 }}
                  >
                    Add All
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DeselectIcon />}
                    onClick={handleRemoveAll}
                    sx={{ textTransform: 'none', color: 'text.secondary', fontWeight: 600 }}
                  >
                    Remove All
                  </Button>
                </Box>
              </Box>

              {/* Customer list */}
              <Box
                sx={{
                  maxHeight: 360,
                  overflow: 'auto',
                  border: '1px solid #EDE5D8',
                  borderRadius: 1,
                }}
              >
                <List dense disablePadding>
                  {filteredTenants.map((t) => (
                    <ListItem key={t.id} disablePadding divider>
                      <ListItemButton
                        onClick={() => handleToggle(t.id)}
                        dense
                        sx={{
                          '&:hover': { bgcolor: '#FAF7F2' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Checkbox
                            edge="start"
                            checked={selectedIds.has(t.id)}
                            size="small"
                            sx={{
                              color: '#B8914A',
                              '&.Mui-checked': { color: '#B8914A' },
                            }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={`${t.firstName} ${t.lastName}`}
                          secondary={
                            <Box
                              component="span"
                              sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
                            >
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ color: 'text.secondary' }}
                              >
                                {t.email}
                              </Typography>
                              {t.unit && (
                                <Chip
                                  label={`Unit ${t.unit}`}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.65rem',
                                    bgcolor: '#F3F4F6',
                                    color: '#6B7280',
                                  }}
                                />
                              )}
                            </Box>
                          }
                          primaryTypographyProps={{
                            fontWeight: 500,
                            fontSize: '0.85rem',
                          }}
                        />
                        <Chip
                          label={STATUS_LABELS[t.status]}
                          size="small"
                          sx={{
                            bgcolor: STATUS_COLORS[t.status]?.bg,
                            color: STATUS_COLORS[t.status]?.color,
                            fontWeight: 600,
                            fontSize: '0.65rem',
                            height: 22,
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                  {filteredTenants.length === 0 && (
                    <ListItem>
                      <ListItemText
                        primary="No customers found"
                        sx={{ textAlign: 'center', color: 'text.secondary', py: 3 }}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Right column: Email composition */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
            <Box sx={sectionHeaderSx}>Compose Email</Box>
            <CardContent sx={{ p: 2.5 }}>
              {/* Template selector */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Template (optional)</InputLabel>
                  <Select
                    label="Select Template (optional)"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    <MenuItem value="">None</MenuItem>
                    {templates.map((t) => (
                      <MenuItem key={t._id} value={t._id}>
                        {t.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleLoadTemplate}
                  disabled={!templateId}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    borderColor: '#B8914A',
                    color: '#B8914A',
                    whiteSpace: 'nowrap',
                    '&:hover': { borderColor: '#9A7A3E', bgcolor: '#FAF7F2' },
                  }}
                >
                  Load Template
                </Button>
              </Box>

              {/* Subject */}
              <TextField
                label="Subject"
                fullWidth
                size="small"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                sx={{ ...inputSx, mb: 2.5 }}
              />

              {/* Body */}
              <TextField
                label="Body"
                fullWidth
                multiline
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                helperText="Available placeholders: {{firstName}}, {{lastName}}, {{email}}, {{unit}}, {{balance}}, {{dueDate}}"
                sx={inputSx}
              />

              {/* Send button */}
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={
                    sending ? (
                      <CircularProgress size={16} sx={{ color: 'white' }} />
                    ) : (
                      <SendIcon />
                    )
                  }
                  onClick={handleSend}
                  disabled={sending || selectedIds.size === 0 || !subject.trim()}
                  sx={{
                    bgcolor: '#B8914A',
                    '&:hover': { bgcolor: '#9A7A3E' },
                    '&.Mui-disabled': { bgcolor: '#D4B87A', color: 'white' },
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 3,
                  }}
                >
                  {sending
                    ? 'Sending...'
                    : `Send Email${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Success snackbar */}
      <Snackbar
        open={successOpen}
        autoHideDuration={4000}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSuccessOpen(false)}
          severity="success"
          variant="filled"
          icon={<EmailIcon sx={{ color: 'white' }} />}
          sx={{
            bgcolor: '#B8914A',
            color: 'white',
            fontWeight: 500,
            '& .MuiAlert-icon': { color: 'white' },
          }}
        >
          Emails sent successfully!
        </Alert>
      </Snackbar>
    </Box>
  )
}
