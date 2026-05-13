'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { formatMoney, formatDate } from '@/lib/utils'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

type LineItem = {
  id: string
  dateCreated: string
  amount: number
  taxRate: number
  description: string
  type: string
}

type Method = 'card' | 'ach' | 'check' | 'cash' | 'external_cc' | 'other'

export default function MakePaymentPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [tenantName, setTenantName] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [credit, setCredit] = useState(0)
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [amountInput, setAmountInput] = useState('')
  const [step, setStep] = useState<1 | 2>(1)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useSetAdminPageTitle(step === 1 ? 'Make a Payment' : 'Make a Payment Summary')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [oRes, tRes] = await Promise.all([
        fetch(`/api/admin/tenants/${tenantId}/outstanding`),
        fetch(`/api/tenants/${tenantId}`),
      ])
      const oJson = await oRes.json()
      const tJson = await tRes.json()
      if (oJson.success) {
        setItems(oJson.data.items)
        setCredit(oJson.data.credit)
        const init: Record<string, boolean> = {}
        for (const it of oJson.data.items) init[it.id] = true
        setSelected(init)
      }
      if (tJson.success) setTenantName(`${tJson.data.firstName} ${tJson.data.lastName}`)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const selectedItems = items.filter((i) => selected[i.id])
  const subtotalCents = selectedItems.reduce((sum, i) => sum + i.amount, 0)
  const taxCents = selectedItems.reduce((sum, i) => sum + Math.round(i.amount * (i.taxRate / 100)), 0)
  const totalCents = subtotalCents + taxCents
  const amountDueCents = Math.max(0, totalCents - credit)

  // Sync amount input when selection changes (only on step 1)
  useEffect(() => {
    if (step === 1) setAmountInput((amountDueCents / 100).toFixed(2))
  }, [amountDueCents, step])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#8CA87C' }} />
      </Box>
    )
  }

  const paymentAmountCents = Math.round((parseFloat(amountInput) || 0) * 100)

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => step === 2 ? setStep(1) : router.push(`/admin/tenants/${tenantId}`)}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          {step === 2 ? 'Back to Items' : 'Back'}
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Playfair Display", serif', flex: 1 }}>
          {step === 1 ? `Make a Payment for ${tenantName}` : 'Make a Payment Summary'}
        </Typography>
      </Box>

      {step === 1 && (
        <ItemsDueStep
          items={items}
          selected={selected}
          setSelected={setSelected}
          subtotalCents={subtotalCents}
          taxCents={taxCents}
          creditCents={credit}
          amountDueCents={amountDueCents}
          amountInput={amountInput}
          setAmountInput={setAmountInput}
          onProceed={() => {
            if (paymentAmountCents <= 0) {
              setErrorMsg('Enter a payment amount')
              return
            }
            setStep(2)
          }}
        />
      )}

      {step === 2 && stripePromise && (
        <Elements stripe={stripePromise}>
          <PaymentSummaryStep
            tenantId={tenantId}
            selectedItems={selectedItems}
            subtotalCents={subtotalCents}
            creditCents={credit}
            amountDueCents={amountDueCents}
            paymentAmountCents={paymentAmountCents}
            setPaymentAmount={(v) => setAmountInput((v / 100).toFixed(2))}
            onAdjust={() => setStep(1)}
            onSuccess={(msg) => {
              setSuccessMsg(msg)
              setTimeout(() => router.push(`/admin/tenants/${tenantId}`), 1500)
            }}
            onError={(m) => setErrorMsg(m)}
          />
        </Elements>
      )}

      {step === 2 && !stripePromise && (
        <Alert severity="warning">
          Stripe public key is not configured. Card / ACH methods will not work.
        </Alert>
      )}

      <Snackbar open={Boolean(successMsg)} autoHideDuration={2500} onClose={() => setSuccessMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>
      </Snackbar>
      <Snackbar open={Boolean(errorMsg)} autoHideDuration={4500} onClose={() => setErrorMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setErrorMsg(null)}>{errorMsg}</Alert>
      </Snackbar>
    </Box>
  )
}

// ── Step 1: Items Due ─────────────────────────────────────────────────────────

function ItemsDueStep({
  items, selected, setSelected, subtotalCents, taxCents, creditCents, amountDueCents,
  amountInput, setAmountInput, onProceed,
}: {
  items: LineItem[]
  selected: Record<string, boolean>
  setSelected: (s: Record<string, boolean>) => void
  subtotalCents: number; taxCents: number; creditCents: number; amountDueCents: number
  amountInput: string
  setAmountInput: (v: string) => void
  onProceed: () => void
}) {
  function selectAll(value: boolean) {
    const next: Record<string, boolean> = {}
    for (const i of items) next[i.id] = value
    setSelected(next)
  }

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ px: 3, py: 2, bgcolor: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Items Due</Typography>
          </Box>

          {items.length === 0 ? (
            <Box sx={{ px: 3, py: 4 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No outstanding items.
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ px: 3, py: 1.5 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Select:&nbsp;
                  <Box component="span" onClick={() => selectAll(true)} sx={{ color: '#1d4ed8', cursor: 'pointer' }}>All</Box>
                  &nbsp;/&nbsp;
                  <Box component="span" onClick={() => selectAll(false)} sx={{ color: '#1d4ed8', cursor: 'pointer' }}>None</Box>
                </Typography>
              </Box>

              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#FAFAFA' } }}>
                    <TableCell padding="checkbox">Pay</TableCell>
                    <TableCell>Date Created</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Tax</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((it) => {
                    const tax = Math.round(it.amount * (it.taxRate / 100))
                    return (
                      <TableRow key={it.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={!!selected[it.id]}
                            onChange={(e) => setSelected({ ...selected, [it.id]: e.target.checked })}
                            sx={{ '&.Mui-checked': { color: '#3B82F6' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(it.dateCreated)}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {it.id.slice(-6)}
                        </TableCell>
                        <TableCell>{it.description}</TableCell>
                        <TableCell align="right">{formatMoney(it.amount)}</TableCell>
                        <TableCell align="right">{formatMoney(tax)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatMoney(it.amount + tax)}</TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow>
                    <TableCell colSpan={6} align="right" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatMoney(subtotalCents + taxCents)}</TableCell>
                  </TableRow>
                  {creditCents > 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="right" sx={{ color: 'text.secondary' }}>Credit</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>-{formatMoney(creditCents)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell colSpan={6} align="right" sx={{ fontWeight: 700, fontSize: '1rem' }}>Amount Due</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '1rem' }}>{formatMoney(amountDueCents)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </>
          )}

          <Box sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Payment Amount</Typography>
            <TextField
              size="small"
              type="number"
              inputProps={{ min: '0', step: '0.01' }}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              sx={{ width: 240, mb: 2 }}
            />
            <Box>
              <Button
                variant="contained"
                onClick={onProceed}
                disableElevation
                sx={{ bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' }, textTransform: 'none', fontWeight: 600 }}
              >
                Proceed to Payment Summary
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </>
  )
}

// ── Step 2: Payment Summary + Method form ─────────────────────────────────────

function PaymentSummaryStep({
  tenantId, selectedItems, subtotalCents, creditCents, amountDueCents, paymentAmountCents,
  setPaymentAmount, onAdjust, onSuccess, onError,
}: {
  tenantId: string
  selectedItems: LineItem[]
  subtotalCents: number; creditCents: number; amountDueCents: number; paymentAmountCents: number
  setPaymentAmount: (cents: number) => void
  onAdjust: () => void
  onSuccess: (msg: string) => void
  onError: (m: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [method, setMethod] = useState<Method>('card')
  const [submitting, setSubmitting] = useState(false)

  // Card / ACH cardholder
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [country, setCountry] = useState('US')
  const [saveForFuture, setSaveForFuture] = useState(false)

  // ACH-specific
  const [routingNumber, setRoutingNumber] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountNumberConfirm, setAccountNumberConfirm] = useState('')

  // Check / Cash batch
  const [checkNumber, setCheckNumber] = useState('')
  const [batchNumber, setBatchNumber] = useState('')

  // Universal description (cash/check/external/other/ach)
  const [description, setDescription] = useState('')

  async function handleSubmit() {
    onError('')
    if (paymentAmountCents <= 0) {
      onError('Enter a payment amount')
      return
    }
    setSubmitting(true)
    try {
      let paymentMethodId: string | undefined
      let achPaymentMethodId: string | undefined

      if (method === 'card') {
        if (!stripe || !elements) throw new Error('Stripe not loaded')
        const card = elements.getElement(CardElement)
        if (!card) throw new Error('Card element not found')
        const { error, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card,
          billing_details: {
            name: `${firstName} ${lastName}`.trim(),
            address: { line1: address, city, state, postal_code: zip, country },
          },
        })
        if (error) throw new Error(error.message ?? 'Card declined')
        paymentMethodId = paymentMethod?.id
      }

      if (method === 'ach') {
        if (!stripe) throw new Error('Stripe not loaded')
        if (accountNumber !== accountNumberConfirm) {
          throw new Error('Account number and confirmation do not match')
        }
        const { error, paymentMethod } = await stripe.createPaymentMethod({
          type: 'us_bank_account',
          us_bank_account: {
            routing_number: routingNumber,
            account_number: accountNumber,
            account_holder_type: 'individual',
            account_type: 'checking',
          },
          billing_details: {
            name: `${firstName} ${lastName}`.trim(),
            address: { line1: address, city, state, postal_code: zip, country },
          },
        } as any)
        if (error) throw new Error(error.message ?? 'ACH setup failed')
        achPaymentMethodId = paymentMethod?.id
      }

      const res = await fetch(`/api/admin/tenants/${tenantId}/apply-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentAmountCents,
          itemIds: selectedItems.map((i) => i.id),
          method,
          paymentMethodId,
          achPaymentMethodId,
          checkNumber: checkNumber || undefined,
          batchNumber: batchNumber || undefined,
          description: description || undefined,
          saveForFuture,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Payment failed')

      onSuccess(`Payment of $${(paymentAmountCents / 100).toFixed(2)} recorded`)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Payment failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ px: 3, py: 2, bgcolor: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Payment Summary</Typography>
        </Box>

        <Box sx={{ px: 3, py: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                <TableCell>Item</TableCell>
                <TableCell>Date Created</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Tax</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedItems.map((it) => {
                const tax = Math.round(it.amount * (it.taxRate / 100))
                return (
                  <TableRow key={it.id}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{it.id.slice(-6)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(it.dateCreated)}</TableCell>
                    <TableCell>{it.description}</TableCell>
                    <TableCell align="right">{formatMoney(it.amount)}</TableCell>
                    <TableCell align="right">{formatMoney(tax)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatMoney(it.amount + tax)}</TableCell>
                  </TableRow>
                )
              })}
              <TableRow>
                <TableCell colSpan={5} align="right" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{formatMoney(subtotalCents)}</TableCell>
              </TableRow>
              {creditCents > 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="right" sx={{ color: 'text.secondary' }}>Credit</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>-{formatMoney(creditCents)}</TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell colSpan={5} align="right" sx={{ fontWeight: 700, fontSize: '1rem' }}>Amount Due</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '1rem' }}>{formatMoney(amountDueCents)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        <Box sx={{ p: 3, borderTop: '1px solid #E5E7EB' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Payment amount</Typography>
          <TextField
            size="small"
            type="number"
            inputProps={{ min: '0', step: '0.01' }}
            value={(paymentAmountCents / 100).toFixed(2)}
            onChange={(e) => setPaymentAmount(Math.round(parseFloat(e.target.value || '0') * 100))}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            sx={{ width: 240, mb: 2 }}
          />

          <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>Payment method</Typography>
          <FormControl size="small" sx={{ minWidth: 280, mb: 3 }}>
            <Select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
              <MenuItem value="card">One Time Credit Card</MenuItem>
              <MenuItem value="ach">One Time ACH</MenuItem>
              <MenuItem value="check">Check</MenuItem>
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="external_cc">External CC Machine</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>

          {/* ── One Time Credit Card ── */}
          {method === 'card' && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>First name</Typography>
                  <TextField fullWidth size="small" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Last name</Typography>
                  <TextField fullWidth size="small" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </Box>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Card details</Typography>
                <Box sx={{ p: 1.5, border: '1px solid #D1D5DB', borderRadius: 1, bgcolor: 'white' }}>
                  <CardElement options={{ style: { base: { fontSize: '15px', color: '#1F2937' } } }} />
                </Box>
              </Box>
              <AddressBlock {...{ address, setAddress, city, setCity, state, setState, zip, setZip, country, setCountry }} />
              <SaveOneTimeCheckbox checked={saveForFuture} onChange={setSaveForFuture} />
            </>
          )}

          {/* ── One Time ACH ── */}
          {method === 'ach' && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Routing number</Typography>
                  <TextField fullWidth size="small" value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} />
                </Box>
                <Box />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Account number</Typography>
                  <TextField fullWidth size="small" type="password" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Confirm account number</Typography>
                  <TextField fullWidth size="small" type="password" value={accountNumberConfirm} onChange={(e) => setAccountNumberConfirm(e.target.value)} />
                </Box>
              </Box>
              <AddressBlock {...{ address, setAddress, city, setCity, state, setState, zip, setZip, country, setCountry }} />
              <DescriptionField value={description} onChange={setDescription} />
              <SaveOneTimeCheckbox checked={saveForFuture} onChange={setSaveForFuture} />
            </>
          )}

          {/* ── Check ── */}
          {method === 'check' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Check number</Typography>
                <TextField fullWidth size="small" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Batch</Typography>
                <TextField fullWidth size="small" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Batch number / group" />
              </Box>
              <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
                <DescriptionField value={description} onChange={setDescription} />
              </Box>
            </Box>
          )}

          {/* ── Cash ── */}
          {method === 'cash' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Batch</Typography>
              <TextField fullWidth size="small" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Batch number / group" sx={{ mb: 2 }} />
              <DescriptionField value={description} onChange={setDescription} />
            </Box>
          )}

          {/* ── External CC Machine ── */}
          {method === 'external_cc' && (
            <Box sx={{ mb: 2 }}>
              <DescriptionField value={description} onChange={setDescription} />
            </Box>
          )}

          {/* ── Other ── */}
          {method === 'other' && (
            <Box sx={{ mb: 2 }}>
              <DescriptionField value={description} onChange={setDescription} />
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, pt: 1 }}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting}
              disableElevation
              sx={{ bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' }, textTransform: 'none', fontWeight: 600 }}
            >
              {submitting ? 'Processing…' : 'Make Payment'}
            </Button>
            <Button onClick={onAdjust} sx={{ color: '#1d4ed8', textTransform: 'none' }}>
              Adjust Payment Amount
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

// ── Shared sub-form helpers ───────────────────────────────────────────────────

function AddressBlock({
  address, setAddress, city, setCity, state, setState, zip, setZip, country, setCountry,
}: {
  address: string; setAddress: (v: string) => void
  city: string; setCity: (v: string) => void
  state: string; setState: (v: string) => void
  zip: string; setZip: (v: string) => void
  country: string; setCountry: (v: string) => void
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Address</Typography>
      <TextField fullWidth size="small" value={address} onChange={(e) => setAddress(e.target.value)} sx={{ mb: 1.5 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 1.5 }}>
        <TextField label="City" size="small" value={city} onChange={(e) => setCity(e.target.value)} />
        <TextField label="State" size="small" value={state} onChange={(e) => setState(e.target.value)} />
        <TextField label="Zip" size="small" value={zip} onChange={(e) => setZip(e.target.value)} />
      </Box>
      <FormControl size="small" sx={{ minWidth: 240, mt: 1.5 }}>
        <InputLabel>Country</InputLabel>
        <Select label="Country" value={country} onChange={(e) => setCountry(e.target.value)}>
          <MenuItem value="US">United States of America</MenuItem>
          <MenuItem value="CA">Canada</MenuItem>
          <MenuItem value="MX">Mexico</MenuItem>
        </Select>
      </FormControl>
    </Box>
  )
}

function DescriptionField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Description</Typography>
      <TextField fullWidth size="small" multiline minRows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </Box>
  )
}

function SaveOneTimeCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <FormControlLabel
      control={<Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} />}
      label={<Typography variant="caption">Save one time payment — saves as inactive payment account</Typography>}
      sx={{ mt: 1 }}
    />
  )
}
