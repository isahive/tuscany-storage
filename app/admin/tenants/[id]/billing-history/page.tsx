'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
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
import PrintIcon from '@mui/icons-material/Print'
import { formatDate, formatMoney } from '@/lib/utils'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

interface PaymentData {
  _id: string
  amount: number
  type: string
  status: string
  direction?: 'charge' | 'payment'
  balanceAfter?: number
  periodStart?: string
  periodEnd?: string
  createdAt: string
  description?: string
  dueDate?: string
}

const PAYMENT_ITEM_LABELS: Record<string, string> = {
  rent: 'Monthly Rent',
  late_fee: 'Past Due Fee',
  deposit: 'Security Deposit',
  prorated: 'Prorated Rent',
  credit: 'Credit',
  other: 'Fee',
}

function paymentItemLabel(p: PaymentData): string {
  if (p.direction === 'payment') {
    if (p.status === 'voided') return 'Void'
    if (p.type === 'credit') return 'Credit'
    if (p.status === 'refunded') return 'Refund'
    const prefix = p.description?.split('—')[0]?.trim()
    return prefix || 'Payment'
  }
  return PAYMENT_ITEM_LABELS[p.type] ?? p.type
}

function paymentDescription(p: PaymentData): string {
  if (p.description) return p.description
  if (p.periodStart && p.periodEnd) {
    return `Period: ${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`
  }
  if (p.dueDate) return `Due ${formatDate(p.dueDate)}`
  return ''
}

function isCreditEntry(p: PaymentData): boolean {
  if (p.direction === 'payment') return true
  return p.type === 'credit' || p.status === 'refunded' || p.amount < 0
}

export default function FullBillingHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [tenantName, setTenantName] = useState('')
  const [unitNumber, setUnitNumber] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [balance, setBalance] = useState(0)
  const [outstanding, setOutstanding] = useState(0)
  const [creditAvailable, setCreditAvailable] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useSetAdminPageTitle('Full Billing and Payments Report')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, pRes, bRes, lRes] = await Promise.all([
        fetch(`/api/tenants/${tenantId}`),
        fetch(`/api/payments?tenantId=${tenantId}&limit=500`),
        fetch(`/api/tenants/${tenantId}/balance`),
        fetch(`/api/leases?tenantId=${tenantId}&limit=10`),
      ])
      const [tJson, pJson, bJson, lJson] = await Promise.all([
        tRes.json(), pRes.json(), bRes.json(), lRes.json(),
      ])
      if (tJson.success) setTenantName(`${tJson.data.firstName} ${tJson.data.lastName}`)
      if (pJson.success) setPayments(pJson.data?.items ?? [])
      if (bJson.success) {
        setBalance(bJson.data.balance ?? 0)
        setOutstanding(bJson.data.outstanding ?? 0)
        setCreditAvailable(bJson.data.credit ?? 0)
      }
      if (lJson.success) {
        const active = (lJson.data?.items ?? []).find((x: any) => x.status === 'active' || x.status === 'pending_moveout')
        setUnitNumber(active && typeof active.unitId === 'object' ? active.unitId.unitNumber : null)
      }
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#8CA87C' }} />
      </Box>
    )
  }

  // balanceAfter is persisted on each Payment row, so the per-row balance
  // comes straight from the document — no full-ledger walk needed.
  const rows = [...payments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((p) => {
      const credit = isCreditEntry(p)
      const isFailed = p.status === 'failed'
      const charges = credit ? 0 : Math.abs(p.amount)
      const paymentsVoids = credit ? Math.abs(p.amount) : 0
      return { p, charges, paymentsVoids, balance: p.balanceAfter ?? 0, credit, isFailed }
    })

  const selectedCount = Object.values(selected).filter(Boolean).length

  function selectAll(value: boolean) {
    const next: Record<string, boolean> = {}
    for (const r of rows) next[r.p._id] = value
    setSelected(next)
  }

  function handlePrint() {
    window.print()
  }

  function handleArchive() {
    if (selectedCount === 0) {
      setErrorMsg('Select at least one row to archive')
      return
    }
    // Archive isn't wired to a backend yet — surfaced as a stub so the UI
    // mirrors Storable's flow; persistence can be added later when the
    // archived-history view ships.
    setSuccessMsg(`${selectedCount} row${selectedCount > 1 ? 's' : ''} marked for archive (UI-only)`)
  }

  return (
    <Box>
      {/* Print-only CSS hides everything but #print-area */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Return to Customer
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Playfair Display", serif', flex: 1 }}>
          Full Billing and Payments Report
        </Typography>
        <Button
          size="small"
          variant="outlined"
          disabled
          sx={{ textTransform: 'none', borderColor: '#D1D5DB', color: 'text.disabled' }}
        >
          Archived History
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PrintIcon fontSize="small" />}
          onClick={handlePrint}
          sx={{ textTransform: 'none', borderColor: '#8CA87C', color: '#5C7350' }}
        >
          As PDF
        </Button>
      </Box>

      <Box id="print-area">
        {/* Summary header — Name | Outstanding | Credit | Balance */}
        <Card sx={{ mb: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center', borderBottom: '1px solid #E5E7EB' }}>
            <Box sx={{ px: 2.5, py: 1.25, bgcolor: '#F3F4F6' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Name</Typography>
            </Box>
            <Box sx={{ px: 2.5, py: 1.25, bgcolor: '#F3F4F6' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Outstanding</Typography>
            </Box>
            <Box sx={{ px: 2.5, py: 1.25, bgcolor: '#F3F4F6' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Credit</Typography>
            </Box>
            <Box sx={{ px: 2.5, py: 1.25, bgcolor: '#F3F4F6' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Balance</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', alignItems: 'center' }}>
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{tenantName}{unitNumber ? ` — Unit ${unitNumber}` : ''}</Typography>
            </Box>
            <Box sx={{ px: 2.5, py: 1.5, bgcolor: outstanding > 0 ? '#FEE2E2' : 'transparent' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatMoney(outstanding)}</Typography>
            </Box>
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatMoney(creditAvailable)}</Typography>
            </Box>
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatMoney(balance)}</Typography>
            </Box>
          </Box>
        </Card>

        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 3, py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Click the checkbox to select rows. Click&nbsp;
                <Box component="span" onClick={() => selectAll(true)} sx={{ color: '#1d4ed8', cursor: 'pointer' }}>All</Box>
                &nbsp;/&nbsp;
                <Box component="span" onClick={() => selectAll(false)} sx={{ color: '#1d4ed8', cursor: 'pointer' }}>None</Box>
              </Typography>
            </Box>

            {rows.length === 0 ? (
              <Box sx={{ px: 3, py: 4 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>No billing history yet.</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#FAFAFA', fontSize: '0.75rem' } }}>
                      <TableCell padding="checkbox" />
                      <TableCell>Date</TableCell>
                      <TableCell>Item</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Charges</TableCell>
                      <TableCell align="right">Payments/Voids</TableCell>
                      <TableCell align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(({ p, charges, paymentsVoids, balance: rowBal, credit, isFailed }) => (
                      <TableRow key={p._id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={!!selected[p._id]}
                            onChange={(e) => setSelected({ ...selected, [p._id]: e.target.checked })}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(p.createdAt)}</TableCell>
                        <TableCell>{paymentItemLabel(p)}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                          {paymentDescription(p) || '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500 }}>
                          {charges > 0 ? formatMoney(charges) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500, color: credit ? '#DC2626' : 'inherit' }}>
                          {paymentsVoids > 0 ? (
                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, justifyContent: 'flex-end' }}>
                              {formatMoney(paymentsVoids)}
                              {p.status === 'voided' && (
                                <Chip label="VOID" size="small" sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 700, fontSize: '0.65rem', height: 18 }} />
                              )}
                              {p.status === 'refunded' && (
                                <Chip label="REFUND" size="small" sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: '0.65rem', height: 18 }} />
                              )}
                              {p.status === 'failed' && (
                                <Chip label="FAILED" size="small" sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 700, fontSize: '0.65rem', height: 18 }} />
                              )}
                            </Box>
                          ) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatMoney(rowBal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Box className="no-print" sx={{ p: 2, borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleArchive}
                disabled={selectedCount === 0}
                disableElevation
                sx={{ bgcolor: '#8CA87C', '&:hover': { bgcolor: '#7E9770' }, textTransform: 'none', fontWeight: 600 }}
              >
                Archive Selected
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Snackbar open={Boolean(successMsg)} autoHideDuration={2500} onClose={() => setSuccessMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>
      </Snackbar>
      <Snackbar open={Boolean(errorMsg)} autoHideDuration={4500} onClose={() => setErrorMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setErrorMsg(null)}>{errorMsg}</Alert>
      </Snackbar>
    </Box>
  )
}
