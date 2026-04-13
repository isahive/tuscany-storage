'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Alert,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import VisibilityIcon from '@mui/icons-material/Visibility'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import DeselectIcon from '@mui/icons-material/Deselect'
import { useRouter } from 'next/navigation'
import { formatMoney, formatDate } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface QueueItem {
  tenantId: string
  tenantName: string
  unitNumber: string
  documentType: 'Invoice' | 'Past Due Notice' | 'Lockout Notice'
  balance: number
  createdAt: string
}

interface BatchRow {
  id: string
  shortId: string
  createdAt: string
  documentsCount: number
  format: string
  status: 'created' | 'printed'
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDocumentType(daysPastDue: number, tenantStatus: string): 'Invoice' | 'Past Due Notice' | 'Lockout Notice' {
  if (tenantStatus === 'locked_out') return 'Lockout Notice'
  if (daysPastDue > 30) return 'Past Due Notice'
  return 'Invoice'
}

const DOC_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  'Invoice':         { bg: '#DBEAFE', color: '#1E40AF' },
  'Past Due Notice': { bg: '#FEF3C7', color: '#92400E' },
  'Lockout Notice':  { bg: '#FEE2E2', color: '#991B1B' },
}

const BATCH_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  created: { bg: '#FEF3C7', color: '#92400E' },
  printed: { bg: '#D1FAE5', color: '#065F46' },
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PrintBatchesPage() {
  const router = useRouter()
  const [tab, setTab] = useState(0)

  // Print Queue state
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all')
  const [creating, setCreating] = useState(false)

  // Batch History state
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [batchesLoading, setBatchesLoading] = useState(true)

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // ── Fetch print queue (delinquent tenants) ──────────────────────────────

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true)
    try {
      const [tenantRes, leaseRes] = await Promise.all([
        fetch('/api/tenants?limit=200'),
        fetch('/api/leases?limit=500'),
      ])
      const tenantJson = await tenantRes.json()
      const leaseJson = await leaseRes.json()

      if (!tenantJson.success || !leaseJson.success) return

      const tenants: Record<string, unknown>[] = tenantJson.data?.items ?? []
      const leases: Record<string, unknown>[] = leaseJson.data?.items ?? []

      // Build lease map: tenantId -> { unitNumber, billingDay }
      const leaseMap = new Map<string, { unitNumber: string; billingDay: number }>()
      for (const l of leases) {
        if (l.status === 'ended') continue
        const tid = typeof l.tenantId === 'object' ? (l.tenantId as Record<string, unknown>)._id as string : l.tenantId as string
        const unitNum = typeof l.unitId === 'object' ? (l.unitId as Record<string, unknown>).unitNumber as string : ''
        leaseMap.set(tid, { unitNumber: unitNum, billingDay: (l.billingDay as number) ?? 1 })
      }

      const now = new Date()
      const items: QueueItem[] = []

      for (const t of tenants) {
        const balance = (t.balance as number) ?? 0
        if (balance <= 0) continue

        const tid = t._id as string
        const lease = leaseMap.get(tid)
        const unitNumber = lease?.unitNumber ?? '—'

        // Calculate days past due
        let daysPastDue = 0
        if (lease) {
          const billingDay = lease.billingDay
          const lastDue = new Date(now.getFullYear(), now.getMonth(), billingDay)
          if (lastDue > now) lastDue.setMonth(lastDue.getMonth() - 1)
          daysPastDue = Math.max(0, Math.floor((now.getTime() - lastDue.getTime()) / (24 * 60 * 60 * 1000)))
        }

        items.push({
          tenantId: tid,
          tenantName: `${t.firstName} ${t.lastName}`,
          unitNumber,
          documentType: getDocumentType(daysPastDue, t.status as string),
          balance,
          createdAt: t.createdAt as string,
        })
      }

      setQueueItems(items)
    } catch {
      // ignore
    } finally {
      setQueueLoading(false)
    }
  }, [])

  // ── Fetch batch history ─────────────────────────────────────────────────

  const fetchBatches = useCallback(async () => {
    setBatchesLoading(true)
    try {
      const res = await fetch('/api/admin/print-batches?limit=50')
      const json = await res.json()
      if (!json.success) return

      const items: BatchRow[] = (json.data?.items ?? []).map((b: Record<string, unknown>) => ({
        id: b._id as string,
        shortId: (b._id as string).slice(-8).toUpperCase(),
        createdAt: b.createdAt as string,
        documentsCount: (b.items as unknown[])?.length ?? 0,
        format: (b.format as string) ?? 'letter',
        status: b.status as 'created' | 'printed',
      }))

      setBatches(items)
    } catch {
      // ignore
    } finally {
      setBatchesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 0) fetchQueue()
    else fetchBatches()
  }, [tab, fetchQueue, fetchBatches])

  // ── Filtered queue ──────────────────────────────────────────────────────

  const filteredQueue = useMemo(() => {
    if (docTypeFilter === 'all') return queueItems
    return queueItems.filter((q) => q.documentType === docTypeFilter)
  }, [queueItems, docTypeFilter])

  // ── Selection helpers ───────────────────────────────────────────────────

  const toggleSelect = (tenantId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(tenantId)) next.delete(tenantId)
      else next.add(tenantId)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(filteredQueue.map((q) => q.tenantId)))
  const selectNone = () => setSelected(new Set())

  // ── Create batch ────────────────────────────────────────────────────────

  const handleCreateBatch = async () => {
    if (selected.size === 0) return
    setCreating(true)

    const items = filteredQueue
      .filter((q) => selected.has(q.tenantId))
      .map((q) => ({
        tenantId: q.tenantId,
        unitNumber: q.unitNumber,
        documentType: q.documentType.toLowerCase().replace(/ /g, '_'),
        balance: q.balance,
      }))

    try {
      const res = await fetch('/api/admin/print-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, format: 'letter' }),
      })
      const json = await res.json()

      if (json.success) {
        setSnackbar({ open: true, message: `Print batch created with ${items.length} document(s)`, severity: 'success' })
        setSelected(new Set())
        setTab(1) // Switch to history
      } else {
        setSnackbar({ open: true, message: json.error ?? 'Failed to create batch', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to create batch', severity: 'error' })
    } finally {
      setCreating(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Print Batches
        </Typography>
      </Box>

      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            borderBottom: '1px solid #EDE5D8',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
            '& .Mui-selected': { color: '#5C3A1E' },
            '& .MuiTabs-indicator': { backgroundColor: '#5C3A1E' },
          }}
        >
          <Tab label="Print Queue" />
          <Tab label="Batch History" />
        </Tabs>

        {/* ── Tab 0: Print Queue ───────────────────────────────────────────── */}
        {tab === 0 && (
          <CardContent sx={{ p: 0 }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', p: 2, borderBottom: '1px solid #EDE5D8' }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Document Type</InputLabel>
                <Select
                  label="Document Type"
                  value={docTypeFilter}
                  onChange={(e) => { setDocTypeFilter(e.target.value); setSelected(new Set()) }}
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="Invoice">Invoice</MenuItem>
                  <MenuItem value="Past Due Notice">Past Due Notice</MenuItem>
                  <MenuItem value="Lockout Notice">Lockout Notice</MenuItem>
                </Select>
              </FormControl>

              <Button size="small" startIcon={<SelectAllIcon />} onClick={selectAll} sx={{ color: '#5C3A1E' }}>
                Select All
              </Button>
              <Button size="small" startIcon={<DeselectIcon />} onClick={selectNone} sx={{ color: '#5C3A1E' }}>
                None
              </Button>

              <Box sx={{ flex: 1 }} />

              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {selected.size} of {filteredQueue.length} selected
              </Typography>
            </Box>

            {queueLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={32} />
              </Box>
            ) : filteredQueue.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  No delinquent tenants in the print queue.
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1C0F06' }}>
                      <TableCell padding="checkbox" sx={{ color: 'white' }}>
                        <Checkbox
                          checked={selected.size === filteredQueue.length && filteredQueue.length > 0}
                          indeterminate={selected.size > 0 && selected.size < filteredQueue.length}
                          onChange={(e) => e.target.checked ? selectAll() : selectNone()}
                          sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: 'white' }, '&.MuiCheckbox-indeterminate': { color: 'white' } }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Customer</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Unit(s)</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Document Type</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Date Added</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredQueue.map((item) => (
                      <TableRow
                        key={item.tenantId}
                        hover
                        onClick={() => toggleSelect(item.tenantId)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#FAF7F2' },
                          '& .MuiTableCell-root': { borderColor: '#EDE5D8' },
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={selected.has(item.tenantId)} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {item.tenantName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {item.unitNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.documentType}
                            size="small"
                            sx={{
                              bgcolor: DOC_TYPE_COLORS[item.documentType]?.bg,
                              color: DOC_TYPE_COLORS[item.documentType]?.color,
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              borderRadius: 1,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {formatDate(item.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 500, color: '#DC2626' }}>
                            {formatMoney(item.balance)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Create Batch button */}
            {filteredQueue.length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, borderTop: '1px solid #EDE5D8' }}>
                <Button
                  variant="contained"
                  startIcon={<PrintIcon />}
                  disabled={selected.size === 0 || creating}
                  onClick={handleCreateBatch}
                  disableElevation
                  sx={{
                    bgcolor: '#5C3A1E',
                    '&:hover': { bgcolor: '#4A2F18' },
                  }}
                >
                  {creating ? 'Creating...' : `Create Print Batch (${selected.size})`}
                </Button>
              </Box>
            )}
          </CardContent>
        )}

        {/* ── Tab 1: Batch History ─────────────────────────────────────────── */}
        {tab === 1 && (
          <CardContent sx={{ p: 0 }}>
            {batchesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={32} />
              </Box>
            ) : batches.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  No print batches have been created yet.
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1C0F06' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Batch #</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Created Date</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Documents</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Format</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600 }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow
                        key={batch.id}
                        hover
                        sx={{
                          '&:hover': { bgcolor: '#FAF7F2' },
                          '& .MuiTableCell-root': { borderColor: '#EDE5D8' },
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                            {batch.shortId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {formatDate(batch.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">{batch.documentsCount}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {batch.format}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={batch.status === 'printed' ? 'Printed' : 'Created'}
                            size="small"
                            sx={{
                              bgcolor: BATCH_STATUS_COLORS[batch.status]?.bg,
                              color: BATCH_STATUS_COLORS[batch.status]?.color,
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              borderRadius: 1,
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            startIcon={<VisibilityIcon />}
                            onClick={() => router.push(`/admin/communications/print-batches/${batch.id}`)}
                            sx={{ color: '#5C3A1E', textTransform: 'none' }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
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
