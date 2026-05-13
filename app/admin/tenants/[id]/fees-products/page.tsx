'use client'

import { useState, useEffect } from 'react'
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
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import { formatMoney } from '@/lib/utils'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

type Fee = { id: string; name: string; amount: number; description?: string }
type Product = { _id: string; name: string; price: number; description?: string; inventory: number; active: boolean; taxRate?: number }

type ModalState =
  | { kind: 'fee'; refId: string; name: string; amount: number; description: string }
  | { kind: 'product'; refId: string; name: string; amount: number; description: string }
  | null

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FeesProductsPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [fees, setFees] = useState<Fee[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [tenantName, setTenantName] = useState('')
  const [defaultTaxRate, setDefaultTaxRate] = useState(0)
  const [loading, setLoading] = useState(true)

  const [selectedFee, setSelectedFee] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [modal, setModal] = useState<ModalState>(null)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useSetAdminPageTitle('Fees/Products')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [fRes, pRes, tRes, sRes] = await Promise.all([
          fetch('/api/admin/fees'),
          fetch('/api/products'),
          fetch(`/api/tenants/${tenantId}`),
          fetch('/api/settings/public'),
        ])
        const [fJson, pJson, tJson, sJson] = await Promise.all([fRes.json(), pRes.json(), tRes.json(), sRes.json()])
        if (cancelled) return
        if (fJson.success) setFees(fJson.data)
        if (pJson.success) setProducts((pJson.data ?? []).filter((p: Product) => p.active))
        if (tJson.success) setTenantName(`${tJson.data.firstName} ${tJson.data.lastName}`)
        if (sJson.success && typeof sJson.data?.taxRate === 'number') setDefaultTaxRate(sJson.data.taxRate)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tenantId])

  function openFeeModal(feeId: string) {
    const fee = fees.find((f) => f.id === feeId)
    if (!fee) return
    setModal({
      kind: 'fee',
      refId: fee.id,
      name: fee.name,
      amount: fee.amount,
      description: fee.description ?? '',
    })
  }

  function openProductModal(productId: string) {
    const p = products.find((pp) => pp._id === productId)
    if (!p) return
    setModal({
      kind: 'product',
      refId: p._id,
      name: p.name,
      amount: p.price,
      description: p.description ?? '',
    })
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#8CA87C' }} />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Back
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Playfair Display", serif', flex: 1 }}>
          Fees/Products{tenantName ? ` — ${tenantName}` : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => router.push(`/admin/tenants/${tenantId}/recurring-billing`)} sx={{ textTransform: 'none' }}>
            Recurring Fees
          </Button>
          <Button variant="outlined" size="small" onClick={() => router.push('/admin/settings/fees')} sx={{ textTransform: 'none' }}>
            Manage Manual Fees
          </Button>
          <Button variant="outlined" size="small" onClick={() => router.push('/admin/retail')} sx={{ textTransform: 'none' }}>
            Manage Products
          </Button>
        </Box>
      </Box>

      <Card sx={{ maxWidth: 720 }}>
        <CardContent sx={{ p: 3 }}>
          {/* Add a fee */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Add a fee</Typography>
          <FormControl fullWidth size="small" sx={{ mb: 3 }}>
            <InputLabel id="fee-label">Select a fee</InputLabel>
            <Select
              labelId="fee-label"
              label="Select a fee"
              value={selectedFee}
              onChange={(e) => {
                const v = e.target.value as string
                setSelectedFee('')
                if (v) openFeeModal(v)
              }}
              disabled={fees.length === 0}
            >
              <MenuItem value="" disabled>
                {fees.length === 0 ? 'No fees configured — go to Manage Manual Fees' : 'Select a fee'}
              </MenuItem>
              {fees.map((f) => (
                <MenuItem key={f.id} value={f.id}>{f.name} — {formatMoney(f.amount)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Add a product */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Add a product</Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="product-label">Select a product</InputLabel>
            <Select
              labelId="product-label"
              label="Select a product"
              value={selectedProduct}
              onChange={(e) => {
                const v = e.target.value as string
                setSelectedProduct('')
                if (v) openProductModal(v)
              }}
              disabled={products.length === 0}
            >
              <MenuItem value="" disabled>
                {products.length === 0 ? 'No products configured — go to Manage Products' : 'Select a product'}
              </MenuItem>
              {products.map((p) => (
                <MenuItem key={p._id} value={p._id}>
                  {p.name} — {formatMoney(p.price)}
                  {p.inventory !== -1 && ` (${p.inventory} in stock)`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      <AddLineItemDialog
        modal={modal}
        defaultTaxRate={defaultTaxRate}
        onClose={() => setModal(null)}
        onSubmit={async (payload) => {
          try {
            const res = await fetch(`/api/admin/tenants/${tenantId}/charges`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to apply')
            setSuccessMsg(`${json.data.label} (${formatMoney(json.data.amount)}) added — new balance ${formatMoney(json.data.balance)}`)
            setModal(null)
            setTimeout(() => router.push(`/admin/tenants/${tenantId}`), 1300)
          } catch (e) {
            setErrorMsg(e instanceof Error ? e.message : 'Failed to apply')
          }
        }}
      />

      <Snackbar open={Boolean(successMsg)} autoHideDuration={2400} onClose={() => setSuccessMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>
      </Snackbar>
      <Snackbar open={Boolean(errorMsg)} autoHideDuration={4000} onClose={() => setErrorMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setErrorMsg(null)}>{errorMsg}</Alert>
      </Snackbar>
    </Box>
  )
}

// ── Add a Fee / Add a Product modal ───────────────────────────────────────────

function AddLineItemDialog({
  modal,
  defaultTaxRate,
  onClose,
  onSubmit,
}: {
  modal: ModalState
  defaultTaxRate: number
  onClose: () => void
  onSubmit: (payload: any) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [taxMode, setTaxMode] = useState<'none' | 'default'>('none')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(todayISO())
  const [autoCharge, setAutoCharge] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!modal) return
    setName(modal.name)
    setAmountInput((modal.amount / 100).toFixed(2))
    setTaxMode('none')
    setDescription(modal.description ?? '')
    setDueDate(todayISO())
    setAutoCharge(true)
    setSubmitting(false)
  }, [modal])

  if (!modal) return null

  const amountCents = Math.round((parseFloat(amountInput) || 0) * 100)
  const taxRate = taxMode === 'default' ? defaultTaxRate : 0
  const taxCents = Math.round(amountCents * (taxRate / 100))
  const subtotalCents = amountCents + taxCents

  const isProduct = modal.kind === 'product'
  const title = isProduct ? 'Add a Product' : 'Add a Fee'
  const submitLabel = isProduct ? 'Add Product' : 'Add Fee'

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await onSubmit({
        kind: modal!.kind,
        refId: modal!.refId,
        name,
        amount: amountCents,
        taxRate,
        description: description || undefined,
        dueDate: new Date(dueDate).toISOString(),
        autoChargeOnDueDate: autoCharge,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, fontWeight: 700 }}>
        {title}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Name</Typography>
          <TextField fullWidth size="small" value={name} onChange={(e) => setName(e.target.value)} />
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Amount</Typography>
          <TextField
            fullWidth
            size="small"
            type="number"
            inputProps={{ min: '0', step: '0.01' }}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          />
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Tax rate</Typography>
          <FormControl fullWidth size="small">
            <Select value={taxMode} onChange={(e) => setTaxMode(e.target.value as 'none' | 'default')}>
              <MenuItem value="none">Don&apos;t Charge Tax</MenuItem>
              <MenuItem value="default" disabled={defaultTaxRate === 0}>
                {defaultTaxRate > 0 ? `Charge Tax (${defaultTaxRate}%)` : 'No default tax set in Settings'}
              </MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Subtotal</Typography>
          <TextField
            fullWidth
            size="small"
            value={(subtotalCents / 100).toFixed(2)}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
              readOnly: true,
            }}
            sx={{ bgcolor: '#F3F4F6' }}
          />
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Description</Typography>
          <TextField fullWidth size="small" multiline minRows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Due Date</Typography>
          <TextField fullWidth size="small" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={autoCharge}
              onChange={(e) => setAutoCharge(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#3B82F6' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#3B82F6' },
              }}
            />
          }
          label={<Typography variant="body2">Charge active payment account on the due date if due after today</Typography>}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          variant="contained"
          disabled={submitting || amountCents < 0 || !name.trim()}
          onClick={handleSubmit}
          disableElevation
          sx={{
            bgcolor: '#3B82F6',
            '&:hover': { bgcolor: '#2563EB' },
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {submitting ? 'Adding…' : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
