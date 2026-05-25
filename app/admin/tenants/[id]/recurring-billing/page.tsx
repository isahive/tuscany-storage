'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

type PaymentMethod = {
  id: string
  brand: string
  last4: string
  expMonth: number | null
  expYear: number | null
  isDefault: boolean
}

type BillingData = {
  paymentMethods: PaymentMethod[]
  defaultPaymentMethodId: string | null
  autopayEnabled: boolean
  billingDateOffset: number
}

function brandLabel(brand: string): string {
  const map: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  }
  return map[brand?.toLowerCase()] ?? (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card')
}

function expString(month: number | null, year: number | null): string {
  if (!month || !year) return ''
  const m = String(month).padStart(2, '0')
  const y = String(year).slice(-2)
  return `${m}/${y}`
}

export default function RecurringBillingPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [tenantName, setTenantName] = useState<string>('')
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [offset, setOffset] = useState<number>(0)
  const [savingOffset, setSavingOffset] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  useSetAdminPageTitle('Recurring Billing')

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const [pmRes, tRes] = await Promise.all([
        fetch(`/api/admin/tenants/${tenantId}/payment-methods`),
        fetch(`/api/tenants/${tenantId}`),
      ])
      const pmJson = await pmRes.json()
      const tJson = await tRes.json()
      if (!pmJson.success) throw new Error(pmJson.error ?? 'Failed to load billing info')
      setData(pmJson.data)
      setOffset(pmJson.data.billingDateOffset ?? 0)
      if (tJson.success) setTenantName(`${tJson.data.firstName} ${tJson.data.lastName}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function handleTogglePause() {
    if (!data) return
    const next = !data.autopayEnabled
    await fetch(`/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autopayEnabled: next }),
    })
    setSavedMsg(next ? 'Auto-pay resumed' : 'Auto-pay paused')
    load()
  }

  async function handleRemove(pmId: string) {
    if (!confirm('Remove this payment account? This cannot be undone.')) return
    await fetch(`/api/admin/tenants/${tenantId}/payment-methods/${pmId}`, { method: 'DELETE' })
    setSavedMsg('Payment account removed')
    load()
  }

  async function handleSaveOffset() {
    setSavingOffset(true)
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingDateOffset: offset }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSavedMsg('Billing date offset updated')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingOffset(false)
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Back
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'var(--font-outfit), system-ui, sans-serif' }}>
          Recurring Billing{tenantName ? ` — ${tenantName}` : ''}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#8CA87C' }} />
        </Box>
      ) : err ? (
        <Alert severity="error">{err}</Alert>
      ) : data ? (
        <Card sx={{ maxWidth: 720 }}>
          <CardContent sx={{ p: 3 }}>
            {/* Info banner */}
            <Alert
              severity="info"
              icon={false}
              sx={{ mb: 3, bgcolor: '#EFF6FF', color: '#1E3A8A', border: '1px solid #BFDBFE' }}
            >
              <Typography variant="body2">
                <strong>One Payment Account may be active at a time.</strong>{' '}
                The active payment account will be used for recurring billing.
              </Typography>
            </Alert>

            {/* Active Payment Account */}
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Active Payment Account:
            </Typography>

            <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 1, mb: 2 }}>
              <Box sx={{ px: 2, py: 1.5, bgcolor: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Account Summary</Typography>
              </Box>

              {data.paymentMethods.length === 0 ? (
                <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No payment account on file. Click <strong>Add Payment Account</strong> below to set one up.
                  </Typography>
                </Box>
              ) : (
                data.paymentMethods.map((pm) => (
                  <Box
                    key={pm.id}
                    sx={{
                      px: 2, py: 1.5,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: '1px solid #F3F4F6',
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Typography variant="body2">
                      {brandLabel(pm.brand)} ending in <strong>{pm.last4}</strong>
                      {pm.expMonth && pm.expYear && ` and exp on ${expString(pm.expMonth, pm.expYear)}`}
                      {pm.isDefault && <Box component="span" sx={{ ml: 1, fontSize: '0.7rem', bgcolor: '#D1FAE5', color: '#065F46', px: 0.75, py: 0.25, borderRadius: 0.5, fontWeight: 700 }}>ACTIVE</Box>}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Button
                        size="small"
                        onClick={() => handleRemove(pm.id)}
                        sx={{ color: '#1d4ed8', textTransform: 'none' }}
                      >
                        Remove
                      </Button>
                      {pm.isDefault && (
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleTogglePause}
                          disableElevation
                          sx={{
                            bgcolor: data.autopayEnabled ? '#9CA3AF' : '#8CA87C',
                            color: 'white',
                            textTransform: 'none',
                            '&:hover': { bgcolor: data.autopayEnabled ? '#6B7280' : '#7E9770' },
                          }}
                        >
                          {data.autopayEnabled ? 'Pause' : 'Resume'}
                        </Button>
                      )}
                    </Box>
                  </Box>
                ))
              )}
            </Box>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
              disableElevation
              sx={{
                bgcolor: '#10B981',
                '&:hover': { bgcolor: '#059669' },
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Add Payment Account
            </Button>

            {/* Billing Date Offset */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Billing Date Offset
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                You can change the number of days after the due date to automatically charge the customer.
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Note that changing this setting does not retroactively change the due date of already invoiced line items.
              </Typography>

              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                Billing Date Offset
              </Typography>
              <TextField
                type="number"
                size="small"
                value={offset}
                onChange={(e) => setOffset(Math.max(0, parseInt(e.target.value || '0', 10)))}
                inputProps={{ min: 0, max: 31 }}
                sx={{ width: 200, mb: 2 }}
              />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleSaveOffset}
                  disabled={savingOffset}
                  disableElevation
                  sx={{
                    bgcolor: '#3B82F6',
                    '&:hover': { bgcolor: '#2563EB' },
                    textTransform: 'none',
                  }}
                >
                  {savingOffset ? 'Saving…' : 'Update'}
                </Button>
                <Button
                  onClick={() => setOffset(data.billingDateOffset ?? 0)}
                  sx={{ color: '#1d4ed8', textTransform: 'none' }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : null}

      {/* Add Payment dialog with Stripe Elements */}
      {addOpen && stripePromise && (
        <Elements stripe={stripePromise}>
          <AddPaymentDialog
            open={addOpen}
            onClose={() => setAddOpen(false)}
            tenantId={tenantId}
            onAdded={() => {
              setAddOpen(false)
              setSavedMsg('Payment account added')
              load()
            }}
          />
        </Elements>
      )}
      {addOpen && !stripePromise && (
        <Dialog open onClose={() => setAddOpen(false)}>
          <DialogTitle>Stripe not configured</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and <code>STRIPE_SECRET_KEY</code> in your env to enable card capture.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar
        open={Boolean(savedMsg)}
        autoHideDuration={2800}
        onClose={() => setSavedMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSavedMsg(null)}>
          {savedMsg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ── Add Payment Method dialog (Stripe Elements) ────────────────────────────────

function AddPaymentDialog({
  open,
  onClose,
  tenantId,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  tenantId: string
  onAdded: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [setDefault, setSetDefault] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intentLoading, setIntentLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setIntentLoading(true)
    setError(null)
    fetch(`/api/admin/tenants/${tenantId}/setup-intent`, { method: 'POST' })
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error)
        setClientSecret(json.data.clientSecret)
      })
      .catch((e) => setError(e.message ?? 'Failed to start payment setup'))
      .finally(() => setIntentLoading(false))
  }, [open, tenantId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || !clientSecret) return
    const card = elements.getElement(CardElement)
    if (!card) return

    setSubmitting(true)
    setError(null)
    try {
      const { error: confirmErr, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        { payment_method: { card } }
      )
      if (confirmErr) throw new Error(confirmErr.message ?? 'Card setup failed')
      if (!setupIntent?.payment_method) throw new Error('Payment method not returned by Stripe')

      const res = await fetch(`/api/admin/tenants/${tenantId}/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId: setupIntent.payment_method, setDefault }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save card')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Payment Account</DialogTitle>
      <DialogContent>
        {intentLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        ) : (
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Enter the customer&apos;s card details. The card is stored securely with Stripe — we never see or store the card number on our servers.
            </Typography>
            <Box
              sx={{
                p: 1.5,
                border: '1px solid #D1D5DB',
                borderRadius: 1,
                bgcolor: 'white',
                mb: 2,
              }}
            >
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '15px',
                      color: '#1F2937',
                      '::placeholder': { color: '#9CA3AF' },
                    },
                  },
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <input
                type="checkbox"
                id="setDefault"
                checked={setDefault}
                onChange={(e) => setSetDefault(e.target.checked)}
              />
              <label htmlFor="setDefault" style={{ fontSize: '0.85rem', color: '#374151' }}>
                Set as active payment account
              </label>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || intentLoading || !stripe || !clientSecret}
          variant="contained"
          disableElevation
          sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' }, textTransform: 'none' }}
        >
          {submitting ? 'Saving…' : 'Save Card'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
