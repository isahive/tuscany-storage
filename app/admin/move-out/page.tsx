'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import PhotoIcon from '@mui/icons-material/Photo'
import GavelIcon from '@mui/icons-material/Gavel'
import { formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type MoveOutStatus = 'pending' | 'approved' | 'denied'

interface MoveOutRow {
  id: string
  tenantName: string
  tenantEmail: string
  unitNumber: string
  requestedMoveOutDate: string
  stripePaymentMethodConfirmed: boolean
  lastFourDigits?: string
  photoUrls: string[]
  status: MoveOutStatus
  adminNotes?: string
  submittedAt: string
  leaseEnded?: boolean
}

const STATUS_COLORS: Record<MoveOutStatus, { bg: string; color: string; label: string }> = {
  pending:  { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
  approved: { bg: '#D1FAE5', color: '#065F46', label: 'Approved' },
  denied:   { bg: '#FEE2E2', color: '#991B1B', label: 'Denied' },
}

function StatusChip({ status }: { status: MoveOutStatus }) {
  const { bg, color, label } = STATUS_COLORS[status]
  return (
    <Chip
      label={label}
      size="small"
      sx={{ bgcolor: bg, color, fontWeight: 600, fontSize: '0.7rem', borderRadius: 1 }}
    />
  )
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

interface DetailDrawerProps {
  row: MoveOutRow | null
  open: boolean
  onClose: () => void
  onDecision: (id: string, status: 'approved' | 'denied', adminNotes: string) => Promise<void>
  onFinalize: (id: string) => Promise<void>
}

function DetailDrawer({ row, open, onClose, onDecision, onFinalize }: DetailDrawerProps) {
  const [adminNotes, setAdminNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [lastRowId, setLastRowId] = useState<string | null>(null)

  if (row && row.id !== lastRowId) {
    setLastRowId(row.id)
    setAdminNotes(row.adminNotes ?? '')
    setActionError(null)
  }

  const handleDecision = async (decision: 'approved' | 'denied') => {
    if (!row) return
    setSubmitting(true)
    setActionError(null)
    try {
      await onDecision(row.id, decision, adminNotes)
      onClose()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFinalize = async () => {
    if (!row) return
    setSubmitting(true)
    setActionError(null)
    try {
      await onFinalize(row.id)
      onClose()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Finalize failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!row) return null

  const isPending = row.status === 'pending'
  const canFinalize = row.status === 'approved' && !row.leaseEnded

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, bgcolor: '#FFFFFF' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid #EDE5D8', bgcolor: '#FAF7F2' }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ fontFamily: '"Playfair Display", serif' }}>
          Move-Out Request
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StatusChip status={row.status} />
          <IconButton size="small" onClick={onClose} aria-label="Close drawer">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ px: 3, py: 2.5, overflowY: 'auto', flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Tenant
        </Typography>
        <Typography variant="body1" fontWeight={600} sx={{ mt: 0.25 }}>
          {row.tenantName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {row.tenantEmail}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Unit</Typography>
            <Typography variant="body2" fontWeight={600}>{row.unitNumber}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Requested Move-Out</Typography>
            <Typography variant="body2" fontWeight={600}>{formatDate(row.requestedMoveOutDate)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Submitted</Typography>
            <Typography variant="body2" fontWeight={600}>{formatDate(row.submittedAt)}</Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <CreditCardIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />
          <Box>
            <Typography variant="body2" fontWeight={500}>Card Confirmation</Typography>
            <Typography variant="caption" color="text.secondary">
              {row.stripePaymentMethodConfirmed
                ? `Confirmed${row.lastFourDigits ? ` — ••••${row.lastFourDigits}` : ''}`
                : 'Not confirmed'}
            </Typography>
          </Box>
          <Chip
            label={row.stripePaymentMethodConfirmed ? 'Confirmed' : 'Not confirmed'}
            size="small"
            sx={{
              ml: 'auto',
              bgcolor: row.stripePaymentMethodConfirmed ? '#D1FAE5' : '#FEF3C7',
              color: row.stripePaymentMethodConfirmed ? '#065F46' : '#92400E',
              fontWeight: 600,
            }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <PhotoIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />
          <Typography variant="body2" fontWeight={500}>
            Unit Photos ({row.photoUrls.length})
          </Typography>
        </Box>

        {row.photoUrls.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No photos submitted.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1 }}>
            {row.photoUrls.map((url, i) => (
              <Box key={url} component="a" href={url} target="_blank" rel="noopener noreferrer" sx={{ display: 'block', borderRadius: 1, overflow: 'hidden' }}>
                <Box component="img" src={url} alt={`Unit photo ${i + 1}`} sx={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', border: '1px solid #EDE5D8', borderRadius: 1 }} />
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Admin Notes</Typography>
        <TextField
          multiline
          minRows={3}
          maxRows={6}
          fullWidth
          size="small"
          placeholder="Optional notes for internal reference…"
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          disabled={!isPending || submitting}
        />

        {actionError && (
          <Alert severity="error" sx={{ mt: 2 }}>{actionError}</Alert>
        )}
      </Box>

      {isPending && (
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid #EDE5D8', display: 'flex', gap: 1.5, bgcolor: '#FAF7F2' }}>
          <Button variant="contained" fullWidth disabled={submitting} startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />} onClick={() => handleDecision('approved')} sx={{ bgcolor: '#065F46', '&:hover': { bgcolor: '#054d38' } }}>
            {submitting ? 'Saving…' : 'Approve'}
          </Button>
          <Button variant="contained" fullWidth disabled={submitting} startIcon={<CancelIcon />} onClick={() => handleDecision('denied')} sx={{ bgcolor: '#991B1B', '&:hover': { bgcolor: '#7f1d1d' } }}>
            Deny
          </Button>
        </Box>
      )}

      {canFinalize && (
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid #EDE5D8', bgcolor: '#FAF7F2' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Approved — ready to finalize. This ends the lease, frees the unit, stops autopay, and sends the move-out receipt.
          </Typography>
          <Button
            variant="contained"
            fullWidth
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <GavelIcon />}
            onClick={handleFinalize}
            sx={{ bgcolor: '#1C0F06', '&:hover': { bgcolor: '#000000' } }}
          >
            {submitting ? 'Finalizing…' : 'Finalize Move-Out'}
          </Button>
        </Box>
      )}

      {row.leaseEnded && (
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid #EDE5D8', bgcolor: '#FAF7F2' }}>
          <Typography variant="caption" color="text.secondary">
            Lease has been ended. This request is fully closed.
          </Typography>
        </Box>
      )}

      {!isPending && !canFinalize && !row.leaseEnded && (
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid #EDE5D8', bgcolor: '#FAF7F2' }}>
          <Typography variant="caption" color="text.secondary">
            This request has already been <strong>{row.status}</strong>.
          </Typography>
        </Box>
      )}
    </Drawer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ApiMoveOut {
  _id: string
  tenantId: { firstName?: string; lastName?: string; email?: string } | null
  unitId: { unitNumber?: string } | null
  leaseId: { status?: string } | null
  requestedMoveOutDate: string
  stripePaymentMethodConfirmed: boolean
  lastFourDigits?: string
  photoUrls: string[]
  status: MoveOutStatus
  adminNotes?: string
  createdAt: string
}

export default function AdminMoveOutPage() {
  const [rows, setRows] = useState<MoveOutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<MoveOutRow | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/move-out')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load')
      const apiRows: MoveOutRow[] = (json.data as ApiMoveOut[]).map((r) => ({
        id: r._id,
        tenantName: r.tenantId ? `${r.tenantId.firstName ?? ''} ${r.tenantId.lastName ?? ''}`.trim() : 'Unknown',
        tenantEmail: r.tenantId?.email ?? '',
        unitNumber: r.unitId?.unitNumber ?? 'N/A',
        requestedMoveOutDate: r.requestedMoveOutDate,
        stripePaymentMethodConfirmed: r.stripePaymentMethodConfirmed,
        lastFourDigits: r.lastFourDigits,
        photoUrls: r.photoUrls ?? [],
        status: r.status,
        adminNotes: r.adminNotes,
        submittedAt: r.createdAt,
        leaseEnded: r.leaseId?.status === 'ended',
      }))
      setRows(apiRows)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleView = useCallback((row: MoveOutRow) => {
    setSelectedRow(row)
    setDrawerOpen(true)
  }, [])

  const handleDecision = useCallback(async (id: string, status: 'approved' | 'denied', adminNotes: string) => {
    const res = await fetch(`/api/move-out/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNotes: adminNotes || undefined }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error ?? 'Failed to update')
    setSnackbar({ open: true, message: `Request ${status}.`, severity: 'success' })
    await load()
  }, [load])

  const handleFinalize = useCallback(async (id: string) => {
    const res = await fetch(`/api/move-out/${id}/finalize`, { method: 'POST' })
    const json = await res.json()
    if (!json.success) throw new Error(json.error ?? 'Failed to finalize')
    const credit = (json.data?.prorationCredit ?? 0) / 100
    const owed = (json.data?.owedTotal ?? 0) / 100
    setSnackbar({
      open: true,
      message: `Move-out finalized. Owed: $${owed.toFixed(2)} · Credit: $${credit.toFixed(2)}.`,
      severity: 'success',
    })
    await load()
  }, [load])

  const columns: GridColDef[] = [
    { field: 'tenantName', headerName: 'Tenant', flex: 1.2, minWidth: 150,
      renderCell: (p: GridRenderCellParams) => <Typography variant="body2" fontWeight={500}>{p.value as string}</Typography> },
    { field: 'unitNumber', headerName: 'Unit', width: 90,
      renderCell: (p: GridRenderCellParams) => <Typography variant="body2" fontWeight={500}>{p.value as string}</Typography> },
    { field: 'requestedMoveOutDate', headerName: 'Requested Date', width: 140,
      renderCell: (p: GridRenderCellParams) => <Typography variant="body2">{formatDate(p.value as string)}</Typography> },
    { field: 'stripePaymentMethodConfirmed', headerName: 'Card Confirmed', width: 130,
      renderCell: (p: GridRenderCellParams) => {
        const c = p.value as boolean
        return <Chip label={c ? 'Yes' : 'No'} size="small" sx={{ bgcolor: c ? '#D1FAE5' : '#FEF3C7', color: c ? '#065F46' : '#92400E', fontWeight: 600, fontSize: '0.7rem' }} />
      },
    },
    { field: 'photoUrls', headerName: 'Photos', width: 80, sortable: false,
      renderCell: (p: GridRenderCellParams) => {
        const n = (p.value as string[]).length
        return <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><PhotoIcon sx={{ fontSize: '1rem', color: n > 0 ? 'primary.main' : 'text.disabled' }} /><Typography variant="body2">{n}</Typography></Box>
      },
    },
    { field: 'status', headerName: 'Status', width: 110,
      renderCell: (p: GridRenderCellParams) => {
        const row = p.row as MoveOutRow
        if (row.leaseEnded) return <Chip label="Finalized" size="small" sx={{ bgcolor: '#E5E7EB', color: '#374151', fontWeight: 600, fontSize: '0.7rem' }} />
        return <StatusChip status={p.value as MoveOutStatus} />
      },
    },
    { field: 'submittedAt', headerName: 'Submitted', width: 130,
      renderCell: (p: GridRenderCellParams) => <Typography variant="body2" color="text.secondary">{formatDate(p.value as string)}</Typography> },
    { field: 'actions', headerName: 'Actions', width: 90, sortable: false, filterable: false,
      renderCell: (p: GridRenderCellParams) => (
        <Tooltip title="View details">
          <IconButton size="small" onClick={() => handleView(p.row as MoveOutRow)} sx={{ color: 'primary.main' }}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ]

  const pendingCount = rows.filter((r) => r.status === 'pending').length
  const approvedNotFinalCount = rows.filter((r) => r.status === 'approved' && !r.leaseEnded).length
  const finalizedCount = rows.filter((r) => r.leaseEnded).length

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', fontWeight: 700 }}>
            Move-Out Requests
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Review and action tenant move-out submissions.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Chip label={`${pendingCount} Pending`} size="small" sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 600 }} />
          <Chip label={`${approvedNotFinalCount} Awaiting Finalize`} size="small" sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 600 }} />
          <Chip label={`${finalizedCount} Finalized`} size="small" sx={{ bgcolor: '#E5E7EB', color: '#374151', fontWeight: 600 }} />
        </Box>
      </Box>

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}

      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          rowHeight={56}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
            sorting: { sortModel: [{ field: 'submittedAt', sort: 'desc' }] },
          }}
          disableRowSelectionOnClick
          sx={{
            border: 'none',
            bgcolor: '#FFFFFF',
            '& .MuiDataGrid-columnHeader': { bgcolor: '#1C0F06', color: '#FFFFFF', fontWeight: 600 },
            '& .MuiDataGrid-sortIcon': { color: 'rgba(255,255,255,0.7)' },
            '& .MuiDataGrid-menuIconButton': { color: 'rgba(255,255,255,0.7)' },
            '& .MuiDataGrid-row:hover': { bgcolor: '#FAF7F2' },
            '& .MuiDataGrid-cell': { borderColor: '#EDE5D8', display: 'flex', alignItems: 'center' },
            '& .MuiDataGrid-footerContainer': { borderColor: '#EDE5D8' },
          }}
        />
      </Card>

      <DetailDrawer
        row={selectedRow}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onDecision={handleDecision}
        onFinalize={handleFinalize}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((p) => ({ ...p, open: false }))} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
