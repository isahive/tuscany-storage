'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Button,
} from '@mui/material'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import DownloadIcon from '@mui/icons-material/Download'
import PaymentIcon from '@mui/icons-material/Payment'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import ReceiptIcon from '@mui/icons-material/Receipt'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { Payment, PaymentStatus } from '@/types'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const formatDate = (date: string | Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

const STATUS_COLORS: Record<PaymentStatus, { bg: string; color: string; label: string }> = {
  succeeded: { bg: '#D1FAE5', color: '#065F46', label: 'Paid' },
  failed:    { bg: '#FEE2E2', color: '#991B1B', label: 'Failed' },
  pending:   { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
  refunded:  { bg: '#F3F4F6', color: '#374151', label: 'Refunded' },
}

function brandLabel(brand: string) {
  const map: Record<string, string> = {
    visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express',
    discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay',
  }
  return map[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1)
}

// ─── Update card form (inside Stripe Elements) ────────────────────────────────

function UpdateCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!stripe || !elements) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/setup-intent', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to initialise')

      const card = elements.getElement(CardElement)
      if (!card) throw new Error('Card element not found')

      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(json.clientSecret, {
        payment_method: { card },
      })
      if (stripeError) throw new Error(stripeError.message ?? 'Card setup failed')
      if (!setupIntent?.payment_method) throw new Error('No payment method returned')

      const saveRes = await fetch('/api/portal/save-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId: setupIntent.payment_method }),
      })
      const saveJson = await saveRes.json()
      if (!saveRes.ok || !saveJson.success) throw new Error(saveJson.error ?? 'Failed to save card')

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update card')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{error}</Alert>}
      <Box
        sx={{
          border: '1px solid #EDE5D8',
          borderRadius: 1.5,
          p: 1.5,
          mb: 2,
          '&:focus-within': { borderColor: '#B8914A' },
          transition: 'border-color 0.15s',
        }}
      >
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1C0F06',
                fontFamily: '"DM Sans", sans-serif',
                '::placeholder': { color: '#9CA3AF' },
              },
              invalid: { color: '#EF4444' },
            },
          }}
        />
      </Box>
      <DialogActions sx={{ px: 0, pb: 0 }}>
        <Button onClick={onCancel} sx={{ color: 'text.secondary', textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !stripe}
          startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : undefined}
          sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}
        >
          {saving ? 'Saving…' : 'Save Card'}
        </Button>
      </DialogActions>
    </Box>
  )
}

// ─── Shared types ─────────────────────────────────────────────────────────────

interface PaymentMethod {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

// ─── Pay Now dialog ───────────────────────────────────────────────────────────

interface PayNowDialogProps {
  open: boolean
  onClose: () => void
  paymentMethod: PaymentMethod | null
  balanceCents: number
  dueDate: string | null
  onSuccess: (msg: string) => void
}

// Inner form — must be inside <Elements> to use useStripe/useElements
function PayNowForm({ onClose, paymentMethod, balanceCents, dueDate, onSuccess }: Omit<PayNowDialogProps, 'open'>) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [useNewCard, setUseNewCard] = useState(!paymentMethod)

  async function handlePay() {
    setPaying(true)
    setLocalError(null)
    try {
      let paymentMethodId: string | undefined

      if (useNewCard) {
        // Save new card first, then charge it
        if (!stripe || !elements) throw new Error('Stripe not loaded')
        const card = elements.getElement(CardElement)
        if (!card) throw new Error('Card element not found')

        const setupRes = await fetch('/api/portal/setup-intent', { method: 'POST' })
        const setupJson = await setupRes.json()
        if (!setupRes.ok || !setupJson.success) throw new Error(setupJson.error ?? 'Failed to initialise')

        const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(setupJson.clientSecret, {
          payment_method: { card },
        })
        if (stripeError) throw new Error(stripeError.message ?? 'Card setup failed')
        if (!setupIntent?.payment_method) throw new Error('No payment method returned')

        const saveRes = await fetch('/api/portal/save-payment-method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethodId: setupIntent.payment_method }),
        })
        const saveJson = await saveRes.json()
        if (!saveRes.ok || !saveJson.success) throw new Error(saveJson.error ?? 'Failed to save card')

        paymentMethodId = setupIntent.payment_method as string
      }

      const res = await fetch('/api/portal/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: balanceCents,
          type: 'rent',
          ...(paymentMethodId ? { paymentMethodId } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Payment failed')
      onSuccess(`Payment of ${formatMoney(balanceCents)} submitted successfully`)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Payment failed')
      setPaying(false)
    }
  }

  function handleClose() {
    setLocalError(null)
    onClose()
  }

  const canPay = !paying && (useNewCard ? !!(stripe && elements) : !!paymentMethod)

  return (
    <>
      <DialogContent>
        {localError && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{localError}</Alert>}

        {/* Amount summary */}
        <Box sx={{ bgcolor: '#FAF7F2', border: '1px solid #EDE5D8', borderRadius: 2, p: 2.5, mb: 2.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Amount due</Typography>
          <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: '#1C0F06' }}>
            {formatMoney(balanceCents)}
          </Typography>
          {dueDate && (
            <Typography variant="caption" color="text.secondary">
              Monthly rent · Due {formatDate(dueDate)}
            </Typography>
          )}
        </Box>

        {/* Card on file row (only shown when not forcing new card) */}
        {paymentMethod && !useNewCard && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, border: '1px solid #EDE5D8', borderRadius: 1.5, mb: 1.5 }}>
            <CreditCardIcon sx={{ color: '#B8914A' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                {brandLabel(paymentMethod.brand)} ••••{paymentMethod.last4}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
              </Typography>
            </Box>
            <Button
              variant="text"
              onClick={() => setUseNewCard(true)}
              sx={{ color: '#B8914A', textTransform: 'none', whiteSpace: 'nowrap', minHeight: 44, '&:hover': { bgcolor: 'rgba(184,145,74,0.08)' } }}
            >
              Use different card
            </Button>
          </Box>
        )}

        {/* New card entry */}
        {useNewCard && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" fontWeight={500}>Enter card details</Typography>
              {paymentMethod && (
                <Button variant="text" onClick={() => setUseNewCard(false)}
                  sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.75rem', minHeight: 44 }}>
                  Use card on file
                </Button>
              )}
            </Box>
            <Box
              sx={{
                border: '1px solid #EDE5D8',
                borderRadius: 1.5,
                p: 1.5,
                '&:focus-within': { borderColor: '#B8914A' },
                transition: 'border-color 0.15s',
              }}
            >
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#1C0F06',
                      fontFamily: '"DM Sans", sans-serif',
                      '::placeholder': { color: '#9CA3AF' },
                    },
                    invalid: { color: '#EF4444' },
                  },
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              This card will be saved as your default payment method.
            </Typography>
          </Box>
        )}

        {/* No card at all */}
        {!paymentMethod && !useNewCard && (
          <Alert severity="warning" sx={{ borderRadius: 1.5 }}>
            No payment method on file.
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={handleClose} sx={{ color: 'text.secondary', textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handlePay}
          disabled={!canPay}
          startIcon={paying ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <PaymentIcon />}
          sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}
        >
          {paying ? 'Processing…' : `Pay ${formatMoney(balanceCents)}`}
        </Button>
      </DialogActions>
    </>
  )
}

function PayNowDialog({ open, onClose, paymentMethod, balanceCents, dueDate, onSuccess }: PayNowDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06' }}>
        Make a Payment
      </DialogTitle>
      {stripePromise ? (
        <Elements stripe={stripePromise}>
          <PayNowForm onClose={onClose} paymentMethod={paymentMethod} balanceCents={balanceCents} dueDate={dueDate} onSuccess={onSuccess} />
        </Elements>
      ) : (
        <>
          <DialogContent>
            <Alert severity="warning">
              Online payments are not available in this environment. Please contact the facility.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { data: session } = useSession()

  const [loadingBilling, setLoadingBilling] = useState(true)
  const [autopay, setAutopay] = useState(false)
  const [autopayLoading, setAutopayLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [balanceCents, setBalanceCents] = useState<number>(0)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(true)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadBilling = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/billing-info')
      const json = await res.json()
      if (json.success) {
        setAutopay(json.data.autopayEnabled)
        setPaymentMethod(json.data.paymentMethod ?? null)
      }
    } catch {
      // silently keep defaults
    } finally {
      setLoadingBilling(false)
    }
  }, [])

  const loadBalance = useCallback(async () => {
    setLoadingBalance(true)
    try {
      const res = await fetch('/api/portal/balance')
      const json = await res.json()
      if (json.success) {
        setBalanceCents(json.data.balance)
        setDueDate(json.data.dueDate)
      }
    } catch {
      // keep zero
    } finally {
      setLoadingBalance(false)
    }
  }, [])

  const loadPayments = useCallback(async () => {
    setLoadingPayments(true)
    try {
      const res = await fetch('/api/portal/payments')
      const json = await res.json()
      if (json.success) setPayments(json.data)
    } catch {
      // keep empty
    } finally {
      setLoadingPayments(false)
    }
  }, [])

  useEffect(() => {
    loadBilling()
    loadBalance()
    loadPayments()
  }, [loadBilling, loadBalance, loadPayments])

  async function handleAutopayToggle(enabled: boolean) {
    setAutopayLoading(true)
    setError(null)
    try {
      const tenantId = session?.user?.id
      if (!tenantId) throw new Error('Not authenticated')
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autopayEnabled: enabled }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to update')
      setAutopay(enabled)
      setSuccessMsg(enabled ? 'Autopay enabled' : 'Autopay disabled')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update autopay')
    } finally {
      setAutopayLoading(false)
    }
  }

  function handleCardSuccess() {
    setCardDialogOpen(false)
    setSuccessMsg('Payment method updated')
    setLoadingBilling(true)
    loadBilling()
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 3 }}>
        Payments
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
      )}
      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg(null)} sx={{ mb: 2, borderRadius: 2, bgcolor: '#B8914A', color: 'white', '& .MuiAlert-icon': { color: 'white' } }}>
          {successMsg}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* Current Balance */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ReceiptIcon sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle1" fontWeight={600}>Current Balance</Typography>
              </Box>
              {loadingBalance ? (
                <CircularProgress size={28} sx={{ color: '#B8914A', mb: 1 }} />
              ) : (
                <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}>
                  {formatMoney(balanceCents)}
                </Typography>
              )}
              {dueDate && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                  Due {formatDate(dueDate)}
                </Typography>
              )}
              <Button
                variant="contained"
                size="large"
                startIcon={<PaymentIcon />}
                onClick={() => setPayOpen(true)}
                disabled={balanceCents === 0}
              >
                {balanceCents === 0 ? 'Paid up to date' : 'Pay now'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Autopay & Saved Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AutorenewIcon sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle1" fontWeight={600}>Autopay</Typography>
              </Box>

              {autopayLoading ? (
                <CircularProgress size={20} sx={{ color: '#B8914A' }} />
              ) : (
                <FormControlLabel
                  control={
                    <Switch
                      checked={autopay}
                      onChange={(e) => handleAutopayToggle(e.target.checked)}
                      color="primary"
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#B8914A' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#B8914A' },
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {autopay ? 'Autopay is enabled' : 'Autopay is disabled'}
                    </Typography>
                  }
                />
              )}
              {autopay && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, ml: 0.5 }}>
                  Your card will be charged automatically on your billing day each month.
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Payment method */}
              {loadingBilling ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} sx={{ color: '#B8914A' }} />
                  <Typography variant="body2" color="text.secondary">Loading…</Typography>
                </Box>
              ) : paymentMethod ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CreditCardIcon sx={{ color: 'text.secondary' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {brandLabel(paymentMethod.brand)} ••••{paymentMethod.last4}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
                    </Typography>
                  </Box>
                  <Button
                    variant="text"
                    startIcon={<EditIcon fontSize="small" />}
                    onClick={() => setCardDialogOpen(true)}
                    sx={{ color: '#B8914A', textTransform: 'none', minHeight: 44, '&:hover': { bgcolor: 'rgba(184,145,74,0.08)' } }}
                  >
                    Update
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">No card on file</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={() => setCardDialogOpen(true)}
                    sx={{ textTransform: 'none', borderColor: '#B8914A', color: '#B8914A', minHeight: 44, '&:hover': { borderColor: '#9A7A3E' } }}
                  >
                    Add Card
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Payment History */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Payment History</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Receipt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingPayments ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} sx={{ color: '#B8914A' }} />
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">No payments on record yet.</Typography>
                    </TableCell>
                  </TableRow>
                ) : payments.map((payment) => {
                  const s = STATUS_COLORS[payment.status]
                  return (
                    <TableRow key={payment._id} hover>
                      <TableCell><Typography variant="body2">{formatDate(payment.createdAt)}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(payment.periodStart)} – {formatDate(payment.periodEnd)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize', fontWeight: 500 }}>
                          {payment.type === 'rent' ? 'Monthly Rent' : payment.type === 'deposit' ? 'Security Deposit' : payment.type === 'late_fee' ? 'Late Fee' : payment.type === 'prorated' ? 'Prorated Rent' : payment.type.replace('_', ' ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{formatMoney(payment.amount)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600 }} />
                      </TableCell>
                      <TableCell align="center">
                        {payment.status === 'succeeded' ? (
                          <Tooltip title="Download receipt">
                            <IconButton component="a" href={`/api/payments/${payment._id}/receipt`} target="_blank" rel="noopener noreferrer" aria-label="Download receipt" sx={{ color: 'primary.main', minWidth: 44, minHeight: 44 }}>
                              <DownloadIcon />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Update / Add card dialog */}
      <Dialog open={cardDialogOpen} onClose={() => setCardDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06' }}>
          {paymentMethod ? 'Update Payment Method' : 'Add Payment Method'}
        </DialogTitle>
        <DialogContent>
          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <UpdateCardForm
                onSuccess={handleCardSuccess}
                onCancel={() => setCardDialogOpen(false)}
              />
            </Elements>
          ) : (
            <Alert severity="warning">
              Online card updates are not available in this environment. Please contact the facility.
            </Alert>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay Now Dialog */}
      <PayNowDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        paymentMethod={paymentMethod}
        balanceCents={balanceCents}
        dueDate={dueDate}
        onSuccess={(msg) => { setPayOpen(false); setSuccessMsg(msg); loadBilling(); loadBalance(); loadPayments() }}
      />
    </Box>
  )
}
