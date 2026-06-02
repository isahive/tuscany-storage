'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
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
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import RefreshIcon from '@mui/icons-material/Refresh'
import BlockIcon from '@mui/icons-material/Block'

interface VisitorRow {
  _id: string
  name: string
  purpose: string
  status: 'active' | 'expired' | 'revoked'
  validFrom: string
  validUntil: string
  createdBy: string
  pdkHolderId?: string
  pdkSyncedAt?: string
  revokedAt?: string
  revokedBy?: string
  expiredAt?: string
  createdAt: string
}

interface IssuedPass {
  id: string
  name: string
  purpose: string
  pin: string
  validFrom: string
  validUntil: string
  pdkHolderId?: string
  pdkSynced: boolean
}

const DURATION_PRESETS = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: '8 hours', minutes: 8 * 60 },
  { label: '24 hours', minutes: 24 * 60 },
]

const STATUS_COLOR: Record<VisitorRow['status'], 'success' | 'default' | 'warning'> = {
  active: 'success',
  expired: 'default',
  revoked: 'warning',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes} min left`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem ? `${hours}h ${rem}m left` : `${hours}h left`
}

export default function VisitorAccessPage() {
  const [rows, setRows] = useState<VisitorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('active')

  // Issue dialog state
  const [issueOpen, setIssueOpen] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [durationMinutes, setDurationMinutes] = useState<number>(180)

  // PIN reveal dialog
  const [issued, setIssued] = useState<IssuedPass | null>(null)

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<VisitorRow | null>(null)
  const [revoking, setRevoking] = useState(false)

  const [snackbar, setSnackbar] = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/admin/visitor-access${qs}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load')
      setRows(json.data as VisitorRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { void fetchRows() }, [fetchRows])

  const resetIssueForm = () => {
    setName('')
    setPurpose('')
    setDurationMinutes(180)
    setIssueError(null)
  }

  const handleIssue = async () => {
    setIssuing(true)
    setIssueError(null)
    try {
      const res = await fetch('/api/admin/visitor-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, purpose, durationMinutes }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to issue pass')
      setIssued(json.data as IssuedPass)
      setIssueOpen(false)
      resetIssueForm()
      void fetchRows()
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : 'Failed to issue pass')
    } finally {
      setIssuing(false)
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      const res = await fetch(`/api/admin/visitor-access/${revokeTarget._id}/revoke`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Revoke failed')
      setSnackbar(`Revoked pass for ${revokeTarget.name}`)
      setRevokeTarget(null)
      void fetchRows()
    } catch (err) {
      setSnackbar(err instanceof Error ? err.message : 'Revoke failed')
    } finally {
      setRevoking(false)
    }
  }

  const copyPin = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.pin)
      setSnackbar('PIN copied to clipboard')
    } catch {
      setSnackbar('Could not copy — please write the PIN down')
    }
  }

  const issueDisabled = useMemo(() => {
    return issuing || !name.trim() || !purpose.trim() || !durationMinutes
  }, [issuing, name, purpose, durationMinutes])

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>Visitor Access</Typography>
          <Typography variant="body2" color="text.secondary">
            Issue time-bounded gate PINs for contractors, vendors, and other visitors.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => void fetchRows()} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { resetIssueForm(); setIssueOpen(true) }}
          >
            New visitor pass
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All (last 7 days)</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="expired">Expired</MenuItem>
          <MenuItem value="revoked">Revoked</MenuItem>
        </TextField>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Purpose</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Window</TableCell>
              <TableCell>Issued by</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No visitor passes match the current filter.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r._id} hover>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.purpose}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={STATUS_COLOR[r.status]}
                    label={r.status}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell>
                  <Stack>
                    <Typography variant="body2">
                      {formatDateTime(r.validFrom)} → {formatDateTime(r.validUntil)}
                    </Typography>
                    {r.status === 'active' && (
                      <Typography variant="caption" color="text.secondary">
                        {formatRemaining(r.validUntil)}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{r.createdBy}</Typography>
                </TableCell>
                <TableCell align="right">
                  {r.status === 'active' && (
                    <Button
                      size="small"
                      color="error"
                      startIcon={<BlockIcon />}
                      onClick={() => setRevokeTarget(r)}
                    >
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Issue dialog */}
      <Dialog open={issueOpen} onClose={() => !issuing && setIssueOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Issue visitor pass</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {issueError && <Alert severity="error">{issueError}</Alert>}
            <TextField
              label="Visitor name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              inputProps={{ maxLength: 35 }}
              helperText="Max 35 characters (shown on the gate keypad logs)."
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Purpose"
              placeholder="e.g. Electrician — unit A12"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              inputProps={{ maxLength: 120 }}
              required
              fullWidth
            />
            <TextField
              select
              label="Duration"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              required
              fullWidth
            >
              {DURATION_PRESETS.map((p) => (
                <MenuItem key={p.minutes} value={p.minutes}>{p.label}</MenuItem>
              ))}
            </TextField>
            <Typography variant="caption" color="text.secondary">
              The pass starts immediately and expires after the selected duration.
              A 6-digit PIN will be generated and shown once.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueOpen(false)} disabled={issuing}>Cancel</Button>
          <Button variant="contained" onClick={handleIssue} disabled={issueDisabled}>
            {issuing ? 'Issuing…' : 'Issue pass'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PIN reveal dialog (shown once) */}
      <Dialog open={!!issued} onClose={() => setIssued(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Pass issued — share this PIN now</DialogTitle>
        <DialogContent>
          {issued && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="warning">
                This PIN will not be shown again. Share it with the visitor before closing this dialog.
              </Alert>
              <Box sx={{
                p: 3,
                border: '2px dashed',
                borderColor: 'primary.main',
                borderRadius: 1,
                textAlign: 'center',
              }}>
                <Typography variant="h2" sx={{ fontFamily: 'monospace', letterSpacing: 8, fontWeight: 600 }}>
                  {issued.pin}
                </Typography>
              </Box>
              <Stack direction="row" justifyContent="center">
                <Button startIcon={<ContentCopyIcon />} onClick={copyPin}>Copy PIN</Button>
              </Stack>
              <Typography variant="body2">
                <strong>{issued.name}</strong> — {issued.purpose}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Valid {formatDateTime(issued.validFrom)} → {formatDateTime(issued.validUntil)}
              </Typography>
              {!issued.pdkSynced && (
                <Alert severity="info">
                  PDK sync did not complete — the cron will retry. Until then,
                  the PIN will not open the gate.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setIssued(null)}>Done</Button>
        </DialogActions>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={!!revokeTarget} onClose={() => !revoking && setRevokeTarget(null)}>
        <DialogTitle>Revoke visitor pass?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will immediately invalidate the PIN for{' '}
            <strong>{revokeTarget?.name}</strong> ({revokeTarget?.purpose}). The
            visitor will be denied at the gate from now on.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeTarget(null)} disabled={revoking}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleRevoke} disabled={revoking}>
            {revoking ? 'Revoking…' : 'Revoke'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
