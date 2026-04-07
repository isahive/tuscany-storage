'use client'

import { useState, useCallback } from 'react'
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
}

// ─── Status chip config ───────────────────────────────────────────────────────

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
      sx={{
        bgcolor: bg,
        color,
        fontWeight: 600,
        fontSize: '0.7rem',
        borderRadius: 1,
      }}
    />
  )
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_ROWS: MoveOutRow[] = [
  {
    id: 'mor-1',
    tenantName: 'Maria Gonzalez',
    tenantEmail: 'm.gonzalez@email.com',
    unitNumber: 'B-14',
    requestedMoveOutDate: '2026-05-10',
    stripePaymentMethodConfirmed: true,
    lastFourDigits: '4242',
    photoUrls: [
      'https://placehold.co/400x300/EDE5D8/1C0F06?text=Unit+Front',
      'https://placehold.co/400x300/EDE5D8/1C0F06?text=Unit+Back',
    ],
    status: 'pending',
    submittedAt: '2026-04-07T09:15:00Z',
  },
  {
    id: 'mor-2',
    tenantName: 'James O\'Brien',
    tenantEmail: 'j.obrien@email.com',
    unitNumber: 'A-06',
    requestedMoveOutDate: '2026-04-30',
    stripePaymentMethodConfirmed: true,
    lastFourDigits: '1881',
    photoUrls: [
      'https://placehold.co/400x300/EDE5D8/1C0F06?text=Photo+1',
      'https://placehold.co/400x300/EDE5D8/1C0F06?text=Photo+2',
      'https://placehold.co/400x300/EDE5D8/1C0F06?text=Photo+3',
    ],
    status: 'approved',
    adminNotes: 'Unit looks clean. Deposit to be returned within 30 days.',
    submittedAt: '2026-03-28T14:30:00Z',
  },
  {
    id: 'mor-3',
    tenantName: 'Rachel Kim',
    tenantEmail: 'r.kim@email.com',
    unitNumber: 'C-22',
    requestedMoveOutDate: '2026-05-15',
    stripePaymentMethodConfirmed: false,
    photoUrls: [],
    status: 'denied',
    adminNotes: 'Outstanding balance of $82.50 must be resolved before move-out is approved.',
    submittedAt: '2026-04-02T11:00:00Z',
  },
]

// ─── Request detail drawer ────────────────────────────────────────────────────

interface DetailDrawerProps {
  row: MoveOutRow | null
  open: boolean
  onClose: () => void
  onDecision: (id: string, status: 'approved' | 'denied', adminNotes: string) => Promise<void>
}

function DetailDrawer({ row, open, onClose, onDecision }: DetailDrawerProps) {
  const [adminNotes, setAdminNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Sync notes when row changes
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

  if (!row) return null

  const isPending = row.status === 'pending'

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 480 },
          p: 0,
          bgcolor: '#FFFFFF',
        },
      }}
    >
      {/* Drawer header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderBottom: '1px solid #EDE5D8',
          bgcolor: '#FAF7F2',
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ fontFamily: '"Playfair Display", serif' }}
        >
          Move-Out Request
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StatusChip status={row.status} />
          <IconButton size="small" onClick={onClose} aria-label="Close drawer">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Drawer body */}
      <Box sx={{ px: 3, py: 2.5, overflowY: 'auto', flex: 1 }}>
        {/* Tenant & unit */}
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
            <Typography variant="caption" color="text.secondary">
              Unit
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {row.unitNumber}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Requested Move-Out
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatDate(row.requestedMoveOutDate)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Submitted
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatDate(row.submittedAt)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Payment confirmation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <CreditCardIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />
          <Box>
            <Typography variant="body2" fontWeight={500}>
              Card Confirmation
            </Typography>
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

        {/* Photo gallery */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <PhotoIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />
          <Typography variant="body2" fontWeight={500}>
            Unit Photos ({row.photoUrls.length})
          </Typography>
        </Box>

        {row.photoUrls.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            No photos submitted.
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 1,
            }}
          >
            {row.photoUrls.map((url, i) => (
              <Box
                key={url}
                component="a"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: 'block', borderRadius: 1, overflow: 'hidden' }}
              >
                <Box
                  component="img"
                  src={url}
                  alt={`Unit photo ${i + 1}`}
                  sx={{
                    width: '100%',
                    aspectRatio: '4/3',
                    objectFit: 'cover',
                    display: 'block',
                    border: '1px solid #EDE5D8',
                    borderRadius: 1,
                    transition: 'opacity 0.15s',
                    '&:hover': { opacity: 0.85 },
                  }}
                />
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Admin notes */}
        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
          Admin Notes
        </Typography>
        <TextField
          multiline
          minRows={3}
          maxRows={6}
          fullWidth
          size="small"
          placeholder="Optional notes for internal reference or tenant communication…"
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          disabled={!isPending || submitting}
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: '#EDE5D8' },
              '&:hover fieldset': { borderColor: '#B8914A' },
            },
          }}
        />

        {actionError && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 1 }}>
            {actionError}
          </Alert>
        )}
      </Box>

      {/* Drawer footer — actions */}
      {isPending && (
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: '1px solid #EDE5D8',
            display: 'flex',
            gap: 1.5,
            bgcolor: '#FAF7F2',
          }}
        >
          <Button
            variant="contained"
            fullWidth
            disabled={submitting}
            startIcon={
              submitting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CheckCircleIcon />
              )
            }
            onClick={() => handleDecision('approved')}
            sx={{
              bgcolor: '#065F46',
              '&:hover': { bgcolor: '#054d38' },
              '&.Mui-disabled': { bgcolor: '#D1FAE5', color: '#9CA3AF' },
            }}
          >
            {submitting ? 'Saving…' : 'Approve'}
          </Button>
          <Button
            variant="contained"
            fullWidth
            disabled={submitting}
            startIcon={<CancelIcon />}
            onClick={() => handleDecision('denied')}
            sx={{
              bgcolor: '#991B1B',
              '&:hover': { bgcolor: '#7f1d1d' },
              '&.Mui-disabled': { bgcolor: '#FEE2E2', color: '#9CA3AF' },
            }}
          >
            Deny
          </Button>
        </Box>
      )}

      {!isPending && (
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: '1px solid #EDE5D8',
            bgcolor: '#FAF7F2',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            This request has already been <strong>{row.status}</strong> and cannot be changed.
          </Typography>
        </Box>
      )}
    </Drawer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminMoveOutPage() {
  const [rows, setRows] = useState<MoveOutRow[]>(INITIAL_ROWS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<MoveOutRow | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const handleView = useCallback((row: MoveOutRow) => {
    setSelectedRow(row)
    setDrawerOpen(true)
  }, [])

  const handleDecision = useCallback(
    async (id: string, status: 'approved' | 'denied', adminNotes: string) => {
      // Call PATCH /api/move-out/:id
      const res = await fetch(`/api/move-out/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes: adminNotes || undefined }),
      })

      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error ?? 'Failed to update request.')
      }

      // Optimistically update local state
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status, adminNotes: adminNotes || r.adminNotes } : r,
        ),
      )
      setSnackbar({
        open: true,
        message: `Request ${status === 'approved' ? 'approved' : 'denied'} successfully.`,
        severity: 'success',
      })
    },
    [],
  )

  // ─── DataGrid columns ──────────────────────────────────────────────────────

  const columns: GridColDef[] = [
    {
      field: 'tenantName',
      headerName: 'Tenant',
      flex: 1.2,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {params.value as string}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'unitNumber',
      headerName: 'Unit',
      width: 90,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={500}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'requestedMoveOutDate',
      headerName: 'Requested Date',
      width: 140,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {formatDate(params.value as string)}
        </Typography>
      ),
    },
    {
      field: 'stripePaymentMethodConfirmed',
      headerName: 'Card Confirmed',
      width: 130,
      renderCell: (params: GridRenderCellParams) => {
        const confirmed = params.value as boolean
        return (
          <Chip
            label={confirmed ? 'Yes' : 'No'}
            size="small"
            sx={{
              bgcolor: confirmed ? '#D1FAE5' : '#FEF3C7',
              color: confirmed ? '#065F46' : '#92400E',
              fontWeight: 600,
              fontSize: '0.7rem',
              borderRadius: 1,
            }}
          />
        )
      },
    },
    {
      field: 'photoUrls',
      headerName: 'Photos',
      width: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const count = (params.value as string[]).length
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PhotoIcon sx={{ fontSize: '1rem', color: count > 0 ? 'primary.main' : 'text.disabled' }} />
            <Typography variant="body2" color={count > 0 ? 'text.primary' : 'text.disabled'}>
              {count}
            </Typography>
          </Box>
        )
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params: GridRenderCellParams) => (
        <StatusChip status={params.value as MoveOutStatus} />
      ),
    },
    {
      field: 'submittedAt',
      headerName: 'Submitted',
      width: 130,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" color="text.secondary">
          {formatDate(params.value as string)}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 90,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as MoveOutRow
        return (
          <Tooltip title="View details">
            <IconButton
              size="small"
              onClick={() => handleView(row)}
              sx={{
                color: 'primary.main',
                '&:hover': { bgcolor: 'rgba(184,145,74,0.08)' },
              }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )
      },
    },
  ]

  // ─── Summary counts ────────────────────────────────────────────────────────

  const pendingCount = rows.filter((r) => r.status === 'pending').length
  const approvedCount = rows.filter((r) => r.status === 'approved').length
  const deniedCount = rows.filter((r) => r.status === 'denied').length

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography
            variant="h5"
            sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', fontWeight: 700 }}
          >
            Move-Out Requests
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Review and action tenant move-out submissions.
          </Typography>
        </Box>

        {/* Summary badges */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Chip
            label={`${pendingCount} Pending`}
            size="small"
            sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 600 }}
          />
          <Chip
            label={`${approvedCount} Approved`}
            size="small"
            sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 600 }}
          />
          <Chip
            label={`${deniedCount} Denied`}
            size="small"
            sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 600 }}
          />
        </Box>
      </Box>

      {/* DataGrid */}
      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <DataGrid
          rows={rows}
          columns={columns}
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
            '& .MuiDataGrid-columnHeader': {
              bgcolor: '#1C0F06',
              color: '#FFFFFF',
              fontWeight: 600,
            },
            '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
            '& .MuiDataGrid-sortIcon': { color: 'rgba(255,255,255,0.7)' },
            '& .MuiDataGrid-menuIconButton': { color: 'rgba(255,255,255,0.7)' },
            '& .MuiDataGrid-columnSeparator': { color: 'rgba(255,255,255,0.2)' },
            '& .MuiDataGrid-row:hover': { bgcolor: '#FAF7F2' },
            '& .MuiDataGrid-cell': {
              borderColor: '#EDE5D8',
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-footerContainer': { borderColor: '#EDE5D8' },
          }}
        />
      </Card>

      {/* Detail drawer */}
      <DetailDrawer
        row={selectedRow}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onDecision={handleDecision}
      />

      {/* Snackbar feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
