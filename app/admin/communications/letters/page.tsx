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
  MenuItem,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SendIcon from '@mui/icons-material/Send'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import DeselectIcon from '@mui/icons-material/Deselect'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
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

const thSx = {
  fontWeight: 600,
  color: 'text.secondary',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LettersPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [templateId, setTemplateId] = useState('')

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

  const filteredTenants = tenants.filter((t) => t.status !== 'moved_out')

  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSelectAll() {
    setSelectedIds(new Set(filteredTenants.map((t) => t.id)))
  }

  function handleSelectNone() {
    setSelectedIds(new Set())
  }

  const allSelected =
    filteredTenants.length > 0 && selectedIds.size === filteredTenants.length

  async function handleSend() {
    if (selectedIds.size === 0) {
      setError('Please select at least one customer.')
      return
    }
    if (!templateId) {
      setError('Please select a notification template.')
      return
    }

    setSending(true)
    setError(null)
    setSendProgress(10)

    try {
      setSendProgress(40)

      const res = await fetch('/api/admin/email-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantIds: Array.from(selectedIds),
          templateId,
        }),
      })
      const json = await res.json()

      setSendProgress(90)

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to send letters')
      }

      setSendProgress(100)
      setSuccessOpen(true)
      setSelectedIds(new Set())
      setTemplateId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send letters')
    } finally {
      setSending(false)
      setSendProgress(0)
    }
  }

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
          Print / Email Letters
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
            Sending letters... {sendProgress}%
          </Typography>
        </Box>
      )}

      {/* Filters row */}
      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
            }}
          >
            <FormControl size="small" sx={{ minWidth: 200 }}>
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

            <FormControl size="small" sx={{ minWidth: 260, flex: 1 }}>
              <InputLabel>Select Notification Template</InputLabel>
              <Select
                label="Select Notification Template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <MenuItem value="">Choose a template...</MenuItem>
                {templates.map((t) => (
                  <MenuItem key={t._id} value={t._id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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
              disabled={sending || selectedIds.size === 0 || !templateId}
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
                : `Send to Selected${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Customer table */}
      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
        <Box sx={sectionHeaderSx}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography
              component="span"
              sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'white' }}
            >
              Customers ({filteredTenants.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                startIcon={<SelectAllIcon sx={{ fontSize: 16 }} />}
                onClick={handleSelectAll}
                sx={{
                  textTransform: 'none',
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  '&:hover': { color: 'white' },
                }}
              >
                Select All
              </Button>
              <Button
                size="small"
                startIcon={<DeselectIcon sx={{ fontSize: 16 }} />}
                onClick={handleSelectNone}
                sx={{
                  textTransform: 'none',
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  '&:hover': { color: 'white' },
                }}
              >
                None
              </Button>
            </Box>
          </Box>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selectedIds.size > 0 && !allSelected}
                    onChange={() => (allSelected ? handleSelectNone() : handleSelectAll())}
                    size="small"
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      '&.Mui-checked': { color: '#B8914A' },
                      '&.MuiCheckbox-indeterminate': { color: '#B8914A' },
                    }}
                  />
                </TableCell>
                <TableCell sx={thSx}>Name</TableCell>
                <TableCell sx={thSx}>Unit</TableCell>
                <TableCell sx={thSx}>Email</TableCell>
                <TableCell sx={{ ...thSx, display: { xs: 'none', sm: 'table-cell' } }}>
                  Phone
                </TableCell>
                <TableCell sx={thSx} align="center">
                  Status
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTenants.map((t) => (
                <TableRow
                  key={t.id}
                  hover
                  onClick={() => handleToggle(t.id)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#FAF7F2' },
                    '&:last-child td': { borderBottom: 0 },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      size="small"
                      sx={{
                        color: '#B8914A',
                        '&.Mui-checked': { color: '#B8914A' },
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {t.firstName} {t.lastName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {t.unit || '\u2014'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {t.email}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {t.phone}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={STATUS_LABELS[t.status]}
                      size="small"
                      sx={{
                        bgcolor: STATUS_COLORS[t.status]?.bg,
                        color: STATUS_COLORS[t.status]?.color,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filteredTenants.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}
                  >
                    No customers found for this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

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
          icon={<MailOutlineIcon sx={{ color: 'white' }} />}
          sx={{
            bgcolor: '#B8914A',
            color: 'white',
            fontWeight: 500,
            '& .MuiAlert-icon': { color: 'white' },
          }}
        >
          Letters sent successfully!
        </Alert>
      </Snackbar>
    </Box>
  )
}
