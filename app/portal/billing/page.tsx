'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Snackbar,
  Switch,
  Typography,
} from '@mui/material'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

// ── Card brand icon label ─────────────────────────────────────────────────────

function brandLabel(brand: string) {
  const map: Record<string, string> = {
    visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express',
    discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay',
  }
  return map[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1)
}

// ── UpdateCardForm (inside Elements context) ──────────────────────────────────

function UpdateCardForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!stripe || !elements) return
    setSaving(true)
    setError(null)
    try {
      // Get SetupIntent client secret
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

      // Save on tenant
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
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
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
                fontSize: '15px',
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

// ── Main page ─────────────────────────────────────────────────────────────────

interface BillingInfo {
  autopayEnabled: boolean
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null
  hasStripe: boolean
}

export default function BillingPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(true)
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [autopay, setAutopay] = useState(false)
  const [autopayLoading, setAutopayLoading] = useState(false)
  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const loadBilling = useCallback(async () => {
    try {
      const [settingsRes, billingRes] = await Promise.all([
        fetch('/api/settings/public'),
        fetch('/api/portal/billing-info'),
      ])
      const [settingsJson, billingJson] = await Promise.all([
        settingsRes.json(),
        billingRes.json(),
      ])
      if (settingsJson.success) setCanEdit(settingsJson.data.customersCanEditBilling ?? true)
      if (billingJson.success) {
        setBilling(billingJson.data)
        setAutopay(billingJson.data.autopayEnabled)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing info')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user?.id) loadBilling()
  }, [session?.user?.id, loadBilling])

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
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to update autopay')
      setAutopay(enabled)
      setSavedMsg(enabled ? 'Autopay enabled' : 'Autopay disabled')
      setSavedOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update autopay')
    } finally {
      setAutopayLoading(false)
    }
  }

  function handleCardSuccess() {
    setCardDialogOpen(false)
    setSavedMsg('Payment method updated')
    setSavedOpen(true)
    loadBilling()
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <CreditCardIcon sx={{ color: '#B8914A', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06' }}>
          Billing &amp; Payments
        </Typography>
      </Box>

      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
          Billing changes are currently disabled. Please contact the facility to update your payment information.
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ bgcolor: 'white', border: '1px solid #EDE5D8', borderRadius: 2, p: 3, maxWidth: 560 }}>

        {/* Autopay */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 1.5 }}>
          Autopay
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1C0F06' }}>
              Automatic Payments
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Your card will be charged automatically on the billing day each month.
            </Typography>
          </Box>
          {autopayLoading ? (
            <CircularProgress size={20} sx={{ color: '#B8914A', ml: 2 }} />
          ) : (
            <FormControlLabel
              control={
                <Switch
                  checked={autopay}
                  onChange={(e) => canEdit && handleAutopayToggle(e.target.checked)}
                  disabled={!canEdit}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#B8914A' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#B8914A' },
                  }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AutorenewIcon sx={{ fontSize: 16, color: autopay ? '#B8914A' : 'text.disabled' }} />
                  <Typography variant="body2" sx={{ color: autopay ? '#B8914A' : 'text.secondary', fontWeight: 500 }}>
                    {autopay ? 'On' : 'Off'}
                  </Typography>
                </Box>
              }
              labelPlacement="start"
              sx={{ ml: 0 }}
            />
          )}
        </Box>

        <Divider sx={{ my: 3, borderColor: '#EDE5D8' }} />

        {/* Payment method */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', mb: 1.5 }}>
          Payment Method
        </Typography>
        {billing?.paymentMethod ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 42, height: 28, bgcolor: '#F3F4F6', borderRadius: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid #EDE5D8',
                }}
              >
                <CreditCardIcon sx={{ fontSize: 18, color: '#6B7280' }} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1C0F06' }}>
                  {brandLabel(billing.paymentMethod.brand)} •••• {billing.paymentMethod.last4}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Expires {billing.paymentMethod.expMonth}/{billing.paymentMethod.expYear}
                </Typography>
              </Box>
            </Box>
            {canEdit && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setCardDialogOpen(true)}
                sx={{ textTransform: 'none', borderColor: '#EDE5D8', color: '#1C0F06', '&:hover': { borderColor: '#B8914A', color: '#B8914A' }, whiteSpace: 'nowrap' }}
              >
                Update Card
              </Button>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No payment method on file.
            </Typography>
            {canEdit && (
              <Button
                size="small"
                variant="contained"
                onClick={() => setCardDialogOpen(true)}
                sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                Add Card
              </Button>
            )}
          </Box>
        )}

      </Box>

      {/* Update card dialog */}
      <Dialog open={cardDialogOpen} onClose={() => setCardDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06' }}>
          {billing?.paymentMethod ? 'Update Payment Method' : 'Add Payment Method'}
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

      <Snackbar open={savedOpen} autoHideDuration={3000} onClose={() => setSavedOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSavedOpen(false)} severity="success" variant="filled" sx={{ bgcolor: '#B8914A', color: 'white', fontWeight: 500, '& .MuiAlert-icon': { color: 'white' } }}>
          {savedMsg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
