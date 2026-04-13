'use client'

import { useState, useEffect } from 'react'
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
  CircularProgress,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import RefreshIcon from '@mui/icons-material/Refresh'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import BlockIcon from '@mui/icons-material/Block'
import KeyIcon from '@mui/icons-material/Key'
import LockIcon from '@mui/icons-material/Lock'
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

export default function GateCodePage() {
  const [revealed, setRevealed] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [newCodeRequested, setNewCodeRequested] = useState(false)
  const [loading, setLoading] = useState(true)
  const [gateCode, setGateCode] = useState<string | null>(null)
  const [signedAt, setSignedAt] = useState<string | null>(null)
  const [unitId, setUnitId] = useState<string>('')

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

      {/* Access Log — placeholder until gate system is integrated */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Access History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Access history will appear here once the gate system is connected.
          </Typography>
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
