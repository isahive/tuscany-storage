'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PrintIcon from '@mui/icons-material/Print'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useParams, useRouter } from 'next/navigation'
import { formatMoney, formatDate } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface BatchItem {
  tenantId: { _id: string; firstName: string; lastName: string } | string
  unitNumber: string
  documentType: string
  balance: number
}

interface BatchDetail {
  _id: string
  items: BatchItem[]
  format: string
  status: 'created' | 'printed'
  printedAt?: string
  createdBy: string
  createdAt: string
}

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: 'Invoice',
  past_due_notice: 'Past Due Notice',
  lockout_notice: 'Lockout Notice',
  foreclosure_notice: 'Foreclosure Notice',
}

const DOC_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  invoice:             { bg: '#DBEAFE', color: '#1E40AF' },
  past_due_notice:     { bg: '#FEF3C7', color: '#92400E' },
  lockout_notice:      { bg: '#FEE2E2', color: '#991B1B' },
  foreclosure_notice:  { bg: '#FDE8E8', color: '#9B1C1C' },
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  created: { bg: '#FEF3C7', color: '#92400E' },
  printed: { bg: '#D1FAE5', color: '#065F46' },
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PrintBatchDetailPage() {
  const router = useRouter()
  const params = useParams()
  const batchId = params.id as string

  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const fetchBatch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/print-batches/${batchId}`)
      const json = await res.json()
      if (json.success) {
        setBatch(json.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [batchId])

  useEffect(() => {
    fetchBatch()
  }, [fetchBatch])

  const handleMarkPrinted = async () => {
    setMarking(true)
    try {
      const res = await fetch(`/api/admin/print-batches/${batchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'printed' }),
      })
      const json = await res.json()
      if (json.success) {
        setBatch(json.data)
        setSnackbar({ open: true, message: 'Batch marked as printed', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: json.error ?? 'Failed to update', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to update', severity: 'error' })
    } finally {
      setMarking(false)
    }
  }

  const getTenantName = (item: BatchItem): string => {
    if (typeof item.tenantId === 'object' && item.tenantId !== null) {
      return `${item.tenantId.firstName} ${item.tenantId.lastName}`
    }
    return String(item.tenantId)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress size={40} />
      </Box>
    )
  }

  if (!batch) {
    return (
      <Box sx={{ textAlign: 'center', py: 12 }}>
        <Typography variant="h6" sx={{ color: 'text.secondary', mb: 2 }}>
          Batch not found
        </Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/admin/communications/print-batches')}
          sx={{ color: '#5C3A1E' }}
        >
          Back to Print Batches
        </Button>
      </Box>
    )
  }

  const shortId = batch._id.slice(-8).toUpperCase()

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/admin/communications/print-batches')}
            sx={{ color: '#5C3A1E', mb: 1, textTransform: 'none' }}
          >
            Back to Print Batches
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Print Batch #{shortId}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => router.push('/admin/communications/print-batches')}
          sx={{ borderColor: '#5C3A1E', color: '#5C3A1E', textTransform: 'none' }}
        >
          New Print Batch
        </Button>
      </Box>

      {/* Batch Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Batch ID</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{shortId}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Created</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{formatDate(batch.createdAt)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Format</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>{batch.format}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Documents</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{batch.items.length}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Status</Typography>
              <Chip
                label={batch.status === 'printed' ? 'Printed' : 'Created'}
                size="small"
                sx={{
                  bgcolor: STATUS_COLORS[batch.status]?.bg,
                  color: STATUS_COLORS[batch.status]?.color,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  borderRadius: 1,
                }}
              />
            </Box>
            {batch.printedAt && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Printed At</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{formatDate(batch.printedAt)}</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#1C0F06' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Customer</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Unit</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Document Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {batch.items.map((item, idx) => {
                const docColors = DOC_TYPE_COLORS[item.documentType] ?? { bg: '#F3F4F6', color: '#374151' }
                return (
                  <TableRow
                    key={idx}
                    hover
                    sx={{
                      '&:hover': { bgcolor: '#FAF7F2' },
                      '& .MuiTableCell-root': { borderColor: '#EDE5D8' },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {getTenantName(item)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {item.unitNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={DOC_TYPE_LABELS[item.documentType] ?? item.documentType}
                        size="small"
                        sx={{
                          bgcolor: docColors.bg,
                          color: docColors.color,
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          borderRadius: 1,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#DC2626' }}>
                        {formatMoney(item.balance)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Mark as Printed */}
        {batch.status === 'created' && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, borderTop: '1px solid #EDE5D8' }}>
            <Button
              variant="contained"
              startIcon={marking ? undefined : <CheckCircleIcon />}
              disabled={marking}
              onClick={handleMarkPrinted}
              disableElevation
              sx={{
                bgcolor: '#065F46',
                '&:hover': { bgcolor: '#064E3B' },
              }}
            >
              {marking ? 'Updating...' : 'Mark as Printed'}
            </Button>
          </Box>
        )}
      </Card>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
