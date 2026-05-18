'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CircularProgress,
  InputAdornment,
  Link as MuiLink,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ReceiptIcon from '@mui/icons-material/Receipt'
import UndoIcon from '@mui/icons-material/Undo'
import { formatDate, formatMoney } from '@/lib/utils'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

interface PaymentDetail {
  _id: string
  amount: number
  status: string
  direction: 'charge' | 'payment'
  type: string
  description?: string
  createdAt: string
  lastAttemptAt?: string
  stripePaymentIntentId?: string
  stripeChargeId?: string
  paymentMethodLabel?: string
  cardholderName?: string
  refundOfPaymentId?: string
  tenantId?: { _id: string; firstName: string; lastName: string; email?: string }
  unitId?: { _id: string; unitNumber: string }
  appliedToItemIds?: Array<{
    _id: string
    amount: number
    type: string
    description?: string
    status: string
    periodStart?: string
    periodEnd?: string
    dueDate?: string
    unitId?: { unitNumber: string }
  }>
}

const CHARGE_TYPE_LABEL: Record<string, string> = {
  rent: 'Monthly Rent',
  late_fee: 'Past Due Fee',
  deposit: 'Security Deposit',
  prorated: 'Prorated Rent',
  credit: 'Credit',
  other: 'Fee',
}

function methodLabel(p: PaymentDetail): string {
  // Charge rows aren't a payment instrument — show the line-item type instead
  // so the Payment Method row stays useful (rent / late fee / etc).
  if (p.direction === 'charge') return CHARGE_TYPE_LABEL[p.type] ?? p.type
  if (p.paymentMethodLabel) return p.paymentMethodLabel
  // Description on payment-direction rows is prefixed with the method
  // (e.g. "Cash — $30 …"). Pull that prefix when present.
  if (p.description) {
    const prefix = p.description.split('—')[0]?.trim()
    if (prefix) return prefix
  }
  if (p.stripePaymentIntentId) return 'Credit Card'
  return 'Other'
}

export default function TransactionDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string
  const paymentId = params.paymentId as string

  const [payment, setPayment] = useState<PaymentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Editable copy of the two fields the live UI lets staff change.
  const [amountInput, setAmountInput] = useState('')
  const [notesInput, setNotesInput] = useState('')

  useSetAdminPageTitle('Transaction Details')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/payments/${paymentId}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to load')
      setPayment(json.data)
      setAmountInput(((json.data.amount ?? 0) / 100).toFixed(2))
      setNotesInput(json.data.description ?? '')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load transaction')
    } finally {
      setLoading(false)
    }
  }, [paymentId])

  useEffect(() => { load() }, [load])

  async function handleUpdate() {
    if (!payment) return
    setSaving(true)
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amountInput),
          notes: notesInput,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Update failed')
      setSuccessMsg('Transaction updated')
      load()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  function handleReceipt() {
    // Receipt endpoint streams a PDF — opening it in a new tab lets the
    // admin print or save it (mirrors Storable's "Receipt" button).
    window.open(`/api/payments/${paymentId}/receipt`, '_blank', 'noopener,noreferrer')
  }

  function handleRefund() {
    router.push(`/admin/tenants/${tenantId}/transaction/${paymentId}/refund`)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#8CA87C' }} />
      </Box>
    )
  }

  if (!payment) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Typography color="error">Transaction not found</Typography>
        <Button onClick={() => router.push(`/admin/tenants/${tenantId}`)} sx={{ mt: 2 }}>
          Return to Customer
        </Button>
      </Box>
    )
  }

  const customerName = payment.tenantId
    ? `${payment.tenantId.firstName} ${payment.tenantId.lastName}`
    : '—'
  const unitLabel = payment.unitId?.unitNumber
    ?? payment.appliedToItemIds?.map((i) => i.unitId?.unitNumber).filter(Boolean).join(', ')
    ?? '—'

  // Refund is only meaningful for succeeded payment-direction rows.
  const canRefund = payment.direction === 'payment'
    && payment.status === 'succeeded'
    && payment.amount > 0

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Return to Customer
        </Button>
      </Box>

      <Card>
        {/* Header strip — title + Refund/Receipt buttons (top-right) */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid #E5E7EB', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#C2410C', fontFamily: '"Playfair Display", serif' }}>
              Transaction Details
            </Typography>
            <Breadcrumbs sx={{ mt: 0.5, fontSize: '0.8rem' }}>
              <MuiLink component="button" onClick={() => router.push('/admin')} sx={{ color: 'text.secondary' }}>
                Home
              </MuiLink>
              <MuiLink component="button" onClick={() => router.push(`/admin/tenants/${tenantId}`)} sx={{ color: 'text.secondary' }}>
                {customerName}
              </MuiLink>
              <Typography variant="caption" sx={{ color: 'text.primary' }}>Transaction Details</Typography>
            </Breadcrumbs>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {canRefund && (
              <Button
                variant="contained"
                size="small"
                startIcon={<UndoIcon fontSize="small" />}
                onClick={handleRefund}
                disableElevation
                sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' }, textTransform: 'none', fontWeight: 600 }}
              >
                Refund
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              startIcon={<ReceiptIcon fontSize="small" />}
              onClick={handleReceipt}
              sx={{ textTransform: 'none', borderColor: '#8CA87C', color: '#5C7350', fontWeight: 600 }}
            >
              Receipt
            </Button>
          </Box>
        </Box>

        <CardContent sx={{ p: 0 }}>
          {/* Read-only field rows — mirrors the live "Created / IP Address /
              Amount / Payment Method / Customer / Unit / Notes" stack. */}
          <DetailRow label="Created" value={`${formatDate(payment.createdAt)} by Admin`} />
          <DetailRow label="IP Address" value="—" />
          <DetailRow label="Amount" value={formatMoney(payment.amount)} />
          <DetailRow label="Payment Method" value={methodLabel(payment)} />
          <DetailRow
            label="Customer"
            value={customerName}
            href={`/admin/tenants/${tenantId}`}
            onNavigate={(h) => router.push(h)}
          />
          <DetailRow label="Unit" value={unitLabel} />
          <DetailRow label="Notes" value={payment.description ?? '—'} multiline />

          {/* Editable Amount + Notes + Update Transaction button */}
          <Box sx={{ px: 3, py: 3, bgcolor: '#FAFAFA', borderTop: '1px solid #E5E7EB' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Amount</Typography>
            <TextField
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9.]/g, ''))}
              size="small"
              sx={{ maxWidth: 200, mb: 2 }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />

            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Notes</Typography>
            <TextField
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              multiline
              rows={3}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            />

            <Button
              variant="contained"
              size="small"
              onClick={handleUpdate}
              disabled={saving}
              disableElevation
              sx={{ bgcolor: '#3F8EBF', '&:hover': { bgcolor: '#347AA8' }, textTransform: 'none', fontWeight: 600 }}
            >
              {saving ? 'Saving…' : 'Update Transaction'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Snackbar open={Boolean(successMsg)} autoHideDuration={2500} onClose={() => setSuccessMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>
      </Snackbar>
      <Snackbar open={Boolean(errorMsg)} autoHideDuration={4500} onClose={() => setErrorMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setErrorMsg(null)}>{errorMsg}</Alert>
      </Snackbar>
    </Box>
  )
}

function DetailRow({
  label, value, href, onNavigate, multiline,
}: {
  label: string
  value: string
  href?: string
  onNavigate?: (href: string) => void
  multiline?: boolean
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: multiline ? 'flex-start' : 'center', borderBottom: '1px solid #F3F0EB', px: 3, py: 1.5 }}>
      <Typography variant="body2" sx={{ minWidth: 160, color: 'text.secondary', fontWeight: 500 }}>
        {label}
      </Typography>
      {href ? (
        <MuiLink component="button" onClick={() => onNavigate?.(href)} variant="body2" sx={{ color: '#1d4ed8', textAlign: 'left' }}>
          {value}
        </MuiLink>
      ) : (
        <Typography variant="body2" sx={{ color: '#1C0F06', whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>
          {value || '—'}
        </Typography>
      )}
    </Box>
  )
}
