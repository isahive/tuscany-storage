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
  FormControl,
  FormControlLabel,
  InputAdornment,
  Link as MuiLink,
  Radio,
  RadioGroup,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { formatDate, formatMoney } from '@/lib/utils'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

type RefundMethod = 'return_to_card' | 'cash' | 'check' | 'other'

interface PaymentDetail {
  _id: string
  amount: number
  status: string
  direction: 'charge' | 'payment'
  description?: string
  stripePaymentIntentId?: string
  paymentMethodLabel?: string
  tenantId?: { _id: string; firstName: string; lastName: string }
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

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  rent: 'rent',
  late_fee: 'past due fee',
  deposit: 'deposit',
  prorated: 'prorated rent',
  other: 'fee',
  credit: 'credit',
}

function lineItemLabel(item: NonNullable<PaymentDetail['appliedToItemIds']>[number]): string {
  if (item.description) return item.description
  const unit = item.unitId?.unitNumber ? `Unit ${item.unitId.unitNumber} ` : ''
  const period = item.periodStart
    ? ` for 1 month period starting ${formatDate(item.periodStart)}`
    : ''
  return `${unit}${PAYMENT_TYPE_LABEL[item.type] ?? item.type}${period}`
}

export default function RefundPaymentPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string
  const paymentId = params.paymentId as string

  const [payment, setPayment] = useState<PaymentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Line item ids the admin is targeting. When the payment covered multiple
  // line items, Storable shows a Refund button next to each — clicking it
  // toggles the item into the selection and pre-fills the amount.
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({})
  const [amountInput, setAmountInput] = useState('')
  const [method, setMethod] = useState<RefundMethod>('return_to_card')
  const [reason, setReason] = useState('')

  useSetAdminPageTitle('Refund Payment')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/payments/${paymentId}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to load')
      setPayment(json.data)
      setAmountInput(((json.data.amount ?? 0) / 100).toFixed(2))
      // Default refund method follows the original payment instrument so
      // staff don't have to re-pick it for the common case.
      setMethod(json.data.stripePaymentIntentId ? 'return_to_card' : 'other')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [paymentId])

  useEffect(() => { load() }, [load])

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
  const maxRefundCents = payment.amount
  const lineItems = payment.appliedToItemIds ?? []
  const hasMultipleItems = lineItems.length > 1
  const selectedIds = Object.keys(selectedItems).filter((id) => selectedItems[id])
  const methodInstrument = payment.paymentMethodLabel
    ?? (payment.stripePaymentIntentId ? 'card' : 'Other')

  function toggleItem(itemId: string, amount: number) {
    const next = { ...selectedItems, [itemId]: !selectedItems[itemId] }
    setSelectedItems(next)
    // Recompute the amount input from the new selection so the totals stay
    // honest as the admin checks/unchecks line items.
    const total = lineItems.reduce((sum, it) => (next[it._id] ? sum + it.amount : sum), 0)
    setAmountInput(total > 0 ? (total / 100).toFixed(2) : (maxRefundCents / 100).toFixed(2))
  }

  async function handleRefund() {
    if (!payment) return
    const amountNum = Number(amountInput)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setErrorMsg('Enter a valid refund amount')
      return
    }
    if (amountNum * 100 > maxRefundCents + 0.5) {
      setErrorMsg(`Refund cannot exceed ${formatMoney(maxRefundCents)}`)
      return
    }

    const confirmed = window.confirm(
      `Issue a refund of $${amountNum.toFixed(2)}? This cannot be undone.`,
    )
    if (!confirmed) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          amount: amountNum,
          lineItemIds: selectedIds.length > 0 ? selectedIds : undefined,
          method,
          reason: reason.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Refund failed')
      setSuccessMsg(`Refunded ${formatMoney(json.data.refundedAmount)}`)
      setTimeout(() => router.push(`/admin/tenants/${tenantId}`), 1200)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Refund failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Title differs depending on whether the admin is refunding the full
  // payment or a single line item — matches the two Storable screenshots
  // ("Refund Payment" vs "Refund Line Item").
  const titleText = selectedIds.length === 1 ? 'Refund Line Item' : 'Refund Payment'

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/admin/tenants/${tenantId}/transaction/${paymentId}`)}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Back to Transaction
        </Button>
      </Box>

      <Card>
        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #E5E7EB' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#C2410C', fontFamily: '"Playfair Display", serif' }}>
            {titleText}
          </Typography>
          <Breadcrumbs sx={{ mt: 0.5, fontSize: '0.8rem' }}>
            <MuiLink component="button" onClick={() => router.push('/admin')} sx={{ color: 'text.secondary' }}>
              Home
            </MuiLink>
            <MuiLink component="button" onClick={() => router.push(`/admin/tenants/${tenantId}`)} sx={{ color: 'text.secondary' }}>
              {customerName}
            </MuiLink>
            <MuiLink component="button" onClick={() => router.push(`/admin/tenants/${tenantId}/transaction/${paymentId}`)} sx={{ color: 'text.secondary' }}>
              Transaction
            </MuiLink>
            <Typography variant="caption" sx={{ color: 'text.primary' }}>{titleText}</Typography>
          </Breadcrumbs>
        </Box>

        <CardContent sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Issuing a refund will change the payment amount in order to reverse the payment and restore the previous balance.
          </Typography>

          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>{customerName}</strong> paid <strong>{formatMoney(maxRefundCents)}</strong> via {methodInstrument}.
            {hasMultipleItems && (
              <>
                {' '}Click <strong>Refund</strong> next to a line item to refund only that item, or leave them un-checked to refund the full payment.
              </>
            )}
          </Typography>

          {/* Multi-line-item picker — only renders when the payment was split
              across multiple charges. Matches step 4 of the Storable article. */}
          {hasMultipleItems && (
            <Box sx={{ mb: 2, border: '1px solid #E5E7EB', borderRadius: 1 }}>
              {lineItems.map((item) => {
                const checked = !!selectedItems[item._id]
                return (
                  <Box
                    key={item._id}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25, borderBottom: '1px solid #F3F0EB', '&:last-child': { borderBottom: 'none' } }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {formatMoney(item.amount)} {lineItemLabel(item)}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant={checked ? 'contained' : 'outlined'}
                      onClick={() => toggleItem(item._id, item.amount)}
                      disableElevation
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        bgcolor: checked ? '#DC2626' : 'transparent',
                        borderColor: '#DC2626',
                        color: checked ? 'white' : '#DC2626',
                        '&:hover': { bgcolor: checked ? '#B91C1C' : '#FEE2E2' },
                      }}
                    >
                      {checked ? 'Selected' : 'Refund'}
                    </Button>
                  </Box>
                )
              })}
            </Box>
          )}

          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Amount to refund</Typography>
          <TextField
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9.]/g, ''))}
            size="small"
            sx={{ maxWidth: 200, mb: 0.5 }}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          />
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 2 }}>
            Max: {formatMoney(maxRefundCents)}
          </Typography>

          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Refund method</Typography>
          <FormControl sx={{ mb: 2 }}>
            <RadioGroup
              value={method}
              onChange={(e) => setMethod(e.target.value as RefundMethod)}
            >
              {payment.stripePaymentIntentId && (
                <FormControlLabel value="return_to_card" control={<Radio size="small" />} label="Return to Credit Card" />
              )}
              <FormControlLabel value="cash" control={<Radio size="small" />} label="Cash" />
              <FormControlLabel value="check" control={<Radio size="small" />} label="Check" />
              <FormControlLabel value="other" control={<Radio size="small" />} label="Other" />
            </RadioGroup>
          </FormControl>

          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Reason</Typography>
          <TextField
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='e.g. "Refunding Deposit"'
            fullWidth
            size="small"
            sx={{ mb: 3 }}
          />

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={handleRefund}
              disabled={submitting}
              disableElevation
              sx={{ bgcolor: '#3F8EBF', '&:hover': { bgcolor: '#347AA8' }, textTransform: 'none', fontWeight: 600 }}
            >
              {submitting ? 'Refunding…' : 'Refund'}
            </Button>
            <Button
              onClick={() => router.push(`/admin/tenants/${tenantId}/transaction/${paymentId}`)}
              sx={{ color: 'text.secondary', textTransform: 'none' }}
            >
              Cancel
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
