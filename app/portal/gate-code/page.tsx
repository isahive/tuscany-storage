'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Chip,
  Divider,
  CircularProgress,
  Stack,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import RefreshIcon from '@mui/icons-material/Refresh'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import BlockIcon from '@mui/icons-material/Block'
import KeyIcon from '@mui/icons-material/Key'
import LockIcon from '@mui/icons-material/Lock'
import SmsIcon from '@mui/icons-material/Sms'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import type { AccessLog, EventType } from '@/types'

const formatDateTime = (date: string | Date): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(date))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function EventChip({ type }: { type: EventType }) {
  const config: Record<EventType, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
    entry:        { label: 'Entry',        bg: '#D1FAE5', color: '#065F46', icon: <ArrowDownwardIcon sx={{ fontSize: 14 }} /> },
    exit:         { label: 'Exit',         bg: '#F3F4F6', color: '#374151', icon: <ArrowUpwardIcon   sx={{ fontSize: 14 }} /> },
    denied:       { label: 'Denied',       bg: '#FEE2E2', color: '#991B1B', icon: <BlockIcon         sx={{ fontSize: 14 }} /> },
    code_changed: { label: 'Code Changed', bg: '#FEF3C7', color: '#92400E', icon: <KeyIcon           sx={{ fontSize: 14 }} /> },
  }
  const c = config[type]
  return (
    <Chip
      label={c.label}
      size="small"
      icon={<Box sx={{ color: c.color, display: 'flex', pl: 0.5 }}>{c.icon}</Box>}
      sx={{ bgcolor: c.bg, color: c.color, fontWeight: 500, '& .MuiChip-icon': { color: 'inherit' } }}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type AccessLogEntry = Pick<AccessLog, '_id' | 'eventType' | 'gateId' | 'source' | 'createdAt'> & {
  notes?: string | null
}

export default function GateCodePage() {
  const [revealed, setRevealed] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [newCodeRequested, setNewCodeRequested] = useState(false)
  const [loading, setLoading] = useState(true)
  const [gateCode, setGateCode] = useState<string | null>(null)
  const [signedAt, setSignedAt] = useState<string | null>(null)
  const [unitId, setUnitId] = useState<string>('')

  // Access history state
  const [logs, setLogs] = useState<AccessLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsTotal, setLogsTotal] = useState(0)
  const [filterEvent, setFilterEvent] = useState<EventType | ''>('')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')

  useEffect(() => {
    fetch('/api/portal/active-lease')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setGateCode(j.data.gateCode || null)
          setSignedAt(j.data.signedAt ?? null)
          setUnitId(j.data.unitId ?? '')
        }
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false))
  }, [])

  const loadLogs = useCallback(() => {
    setLogsLoading(true)
    const qs = new URLSearchParams()
    if (filterEvent) qs.set('eventType', filterEvent)
    if (filterStart) qs.set('startDate', filterStart)
    if (filterEnd) qs.set('endDate', filterEnd)
    qs.set('limit', '100')
    fetch(`/api/portal/access-log?${qs.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setLogs(j.data.logs)
          setLogsTotal(j.data.total)
        }
      })
      .catch(() => {/* ignore */})
      .finally(() => setLogsLoading(false))
  }, [filterEvent, filterStart, filterEnd])

  useEffect(() => {
    if (signedAt) loadLogs()
  }, [signedAt, loadLogs])

  const clearFilters = () => {
    setFilterEvent('')
    setFilterStart('')
    setFilterEnd('')
  }

  const handleRequestNewCode = () => {
    setConfirmOpen(false)
    setNewCodeRequested(true)
    setRevealed(false)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!signedAt) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 3 }}>
          Gate Code
        </Typography>
        <Card>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <LockIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif', mb: 1 }}>
              Lease Not Signed
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
              Your gate access code will be available once you sign your storage lease agreement.
            </Typography>
            {unitId && (
              <Button variant="contained" href={`/reserve/${unitId}`}>
                Sign your lease →
              </Button>
            )}
          </CardContent>
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 3 }}>
        Gate Code
      </Typography>

      {/* Code Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Your Gate Access Code
          </Typography>

          {newCodeRequested && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Your new gate code request has been submitted. You&apos;ll receive it via SMS within a few minutes.
            </Alert>
          )}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 3,
              bgcolor: 'background.default',
              borderRadius: 1,
              border: '1px solid #EDE5D8',
              mb: 2,
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontFamily: 'monospace',
                letterSpacing: '0.3em',
                color: 'secondary.main',
                fontWeight: 700,
                fontSize: { xs: '2rem', sm: '2.5rem' },
              }}
            >
              {revealed ? (gateCode ?? '----') : '••••'}
            </Typography>
            <IconButton
              onClick={() => setRevealed((v) => !v)}
              sx={{ ml: 'auto', color: 'primary.main', minWidth: 44, minHeight: 44 }}
              aria-label={revealed ? 'Hide gate code' : 'Reveal gate code'}
            >
              {revealed ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </IconButton>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Use this 4-digit code on the keypad at the gate entrance and exit. Keep it private.
          </Typography>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Need a new code? We&apos;ll generate one and send it to your phone.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => setConfirmOpen(true)}
            >
              Request new code
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Text-to-Open — feature placeholder */}
      <Card sx={{ mb: 2, bgcolor: 'background.default', borderLeft: '3px solid', borderColor: 'primary.main' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <SmsIcon sx={{ color: 'primary.main', mt: 0.5 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                Text-to-Open <Chip label="Coming Soon" size="small" sx={{ ml: 1 }} />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Open the gate by sending a text from your registered phone — no need to enter your code on the keypad.
                We&apos;ll let you know when this feature is ready to enable.
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Access History */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Access History
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {logsTotal} {logsTotal === 1 ? 'event' : 'events'}
            </Typography>
          </Box>

          {/* Filters */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              select
              size="small"
              label="Event type"
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value as EventType | '')}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">All events</MenuItem>
              <MenuItem value="entry">Entry</MenuItem>
              <MenuItem value="exit">Exit</MenuItem>
              <MenuItem value="denied">Denied</MenuItem>
              <MenuItem value="code_changed">Code Changed</MenuItem>
            </TextField>
            <TextField
              size="small"
              type="date"
              label="From"
              InputLabelProps={{ shrink: true }}
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              InputLabelProps={{ shrink: true }}
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
            />
            {(filterEvent || filterStart || filterEnd) && (
              <Button
                variant="text"
                size="small"
                startIcon={<FilterAltOffIcon />}
                onClick={clearFilters}
              >
                Clear
              </Button>
            )}
          </Stack>

          {logsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : logs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
              No access events match these filters.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Event</TableCell>
                    <TableCell>Gate</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Date &amp; Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log._id} hover>
                      <TableCell>
                        <EventChip type={log.eventType} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {log.gateId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {log.source}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDateTime(log.createdAt)}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>
          Request a New Gate Code?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your current code <strong>{gateCode ?? '----'}</strong> will be deactivated immediately. A new
            4-digit code will be generated and sent to your registered phone number via SMS.
          </DialogContentText>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Make sure you have your phone nearby before proceeding — you&apos;ll need the new code to
            access the facility.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleRequestNewCode} startIcon={<RefreshIcon />}>
            Yes, request new code
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
