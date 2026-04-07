'use client'

import { useState } from 'react'
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Chip,
  Divider,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import RefreshIcon from '@mui/icons-material/Refresh'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import BlockIcon from '@mui/icons-material/Block'
import KeyIcon from '@mui/icons-material/Key'
import type { AccessLog, EventType } from '@/types'

const formatDateTime = (date: string | Date): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(date))

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_GATE_CODE = '4829'

const MOCK_ACCESS_LOGS: AccessLog[] = [
  { _id: '1',  tenantId: 't1', eventType: 'entry',        gateId: 'entrance', source: 'keypad', createdAt: '2026-04-06T14:23:00Z' },
  { _id: '2',  tenantId: 't1', eventType: 'exit',         gateId: 'exit',     source: 'keypad', createdAt: '2026-04-06T15:10:00Z' },
  { _id: '3',  tenantId: 't1', eventType: 'entry',        gateId: 'entrance', source: 'keypad', createdAt: '2026-04-04T09:05:00Z' },
  { _id: '4',  tenantId: 't1', eventType: 'exit',         gateId: 'exit',     source: 'keypad', createdAt: '2026-04-04T09:47:00Z' },
  { _id: '5',  tenantId: 't1', eventType: 'entry',        gateId: 'entrance', source: 'app',    createdAt: '2026-04-01T11:30:00Z' },
  { _id: '6',  tenantId: 't1', eventType: 'exit',         gateId: 'exit',     source: 'app',    createdAt: '2026-04-01T12:05:00Z' },
  { _id: '7',  tenantId: 't1', eventType: 'denied',       gateId: 'entrance', source: 'keypad', createdAt: '2026-03-29T18:22:00Z' },
  { _id: '8',  tenantId: 't1', eventType: 'code_changed', gateId: 'unknown',  source: 'system', createdAt: '2026-03-20T10:00:00Z' },
  { _id: '9',  tenantId: 't1', eventType: 'entry',        gateId: 'entrance', source: 'keypad', createdAt: '2026-03-18T14:00:00Z' },
  { _id: '10', tenantId: 't1', eventType: 'exit',         gateId: 'exit',     source: 'keypad', createdAt: '2026-03-18T14:45:00Z' },
]

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

export default function GateCodePage() {
  const [revealed, setRevealed] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [newCodeRequested, setNewCodeRequested] = useState(false)

  const handleRequestNewCode = () => {
    setConfirmOpen(false)
    setNewCodeRequested(true)
    setRevealed(false)
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
              {revealed ? MOCK_GATE_CODE : '••••'}
            </Typography>
            <IconButton
              onClick={() => setRevealed((v) => !v)}
              sx={{ ml: 'auto', color: 'primary.main' }}
              aria-label={revealed ? 'Hide code' : 'Reveal code'}
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

      {/* Access Log */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Access History
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Event</TableCell>
                  <TableCell>Gate</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Date &amp; Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {MOCK_ACCESS_LOGS.map((log) => (
                  <TableRow key={log._id} hover>
                    <TableCell>
                      <EventChip type={log.eventType} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{log.gateId}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{log.source}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDateTime(log.createdAt)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>
          Request a New Gate Code?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your current code <strong>{MOCK_GATE_CODE}</strong> will be deactivated immediately. A new
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
