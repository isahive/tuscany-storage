'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  Link as MuiLink,
  MenuItem,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'
import { formatMoney } from '@/lib/utils'

/** Parse an `<input type="date">` value (YYYY-MM-DD) as a local date.
 *  new Date('YYYY-MM-DD') treats the string as UTC, which shifts back a day
 *  in negative-offset timezones and breaks every downstream day-math.
 */
function parseLocalDate(s: string): Date {
  if (!s) return new Date(NaN)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ── Types ────────────────────────────────────────────────────────────────────

interface UnitItem {
  _id: string
  unitNumber: string
  size: string
  price: number
  status: string
}
interface ProtectionPlan {
  _id: string
  name: string
  coverageAmount: number
  monthlyPrice: number
}
interface PromotionItem {
  _id: string
  name: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  status: string
}
interface ProductItem { _id: string; name: string; price: number; taxRate: number }
interface FeeItem { id: string; name: string; amount: number; description?: string; active: boolean }

// ── Section card ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: '#1C0F06' }}>
      {children}
    </Typography>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function RentUnitPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // DB-driven sources
  const [tenantName, setTenantName] = useState('')
  const [units, setUnits] = useState<UnitItem[]>([])
  const [plans, setPlans] = useState<ProtectionPlan[]>([])
  const [promotions, setPromotions] = useState<PromotionItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [fees, setFees] = useState<FeeItem[]>([])
  const [settings, setSettings] = useState<any | null>(null)

  // Form state
  const [unitType, setUnitType] = useState('')
  const [unitId, setUnitId] = useState<'auto' | string>('auto')
  const [billingStartDate, setBillingStartDate] = useState('')
  const [planMonthlyRate, setPlanMonthlyRate] = useState(0)
  const [promotionId, setPromotionId] = useState<string>('')
  const [exemptFromRateMgmt, setExemptFromRateMgmt] = useState(false)
  const [protectionPlanId, setProtectionPlanId] = useState<string>('decline')
  const [chargeDeposit, setChargeDeposit] = useState(true)
  const [depositAmount, setDepositAmount] = useState(0)
  const [depositPreviouslyPaid, setDepositPreviouslyPaid] = useState(false)
  const [chargeSetupFee, setChargeSetupFee] = useState(false)
  const [addedFeeId, setAddedFeeId] = useState('')
  const [addedFees, setAddedFees] = useState<Array<{ feeId: string; name: string; amount: number }>>([])
  const [addedProductId, setAddedProductId] = useState('')
  const [addedProducts, setAddedProducts] = useState<Array<{ productId: string; name: string; price: number; quantity: number; taxRate: number }>>([])
  const [prorationModel, setProrationModel] = useState<
    'none' | 'custom' | 'first_month_full_prorate_now' | 'first_month_full_then_prorate' | 'prorate_first_month' | 'prorate_both'
  >('first_month_full_then_prorate')
  const [customProratedRent, setCustomProratedRent] = useState(0)
  const [customProratedProtection, setCustomProratedProtection] = useState(0)
  const [moveInDate, setMoveInDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [taxRate, setTaxRate] = useState(0)
  const [agreementEmail, setAgreementEmail] = useState(false)
  const [agreementText, setAgreementText] = useState(false)

  useSetAdminPageTitle('Rent a Unit')

  const load = useCallback(async () => {
    try {
      const [tRes, uRes, planRes, promoRes, prodRes, feesRes, setRes] = await Promise.all([
        fetch(`/api/tenants/${tenantId}`),
        fetch('/api/units?status=available&limit=all'),
        fetch('/api/protection-plans'),
        fetch('/api/promotions'),
        fetch('/api/products'),
        fetch('/api/admin/fees'),
        fetch('/api/settings'),
      ])
      const tJson = await tRes.json()
      const uJson = await uRes.json()
      const planJson = await planRes.json()
      const promoJson = await promoRes.json()
      const prodJson = await prodRes.json()
      const feesJson = await feesRes.json()
      const setJson = await setRes.json()

      if (tJson.success) setTenantName(`${tJson.data.firstName} ${tJson.data.lastName}`.trim())
      if (uJson.success) setUnits(uJson.data.items.filter((u: UnitItem) => u.status === 'available'))
      if (planJson.success) setPlans(planJson.data.filter((p: any) => p.status === 'active' || !p.status))
      if (promoJson.success) setPromotions(promoJson.data.filter((p: PromotionItem) => p.status === 'active'))
      if (prodJson.success) {
        const list = Array.isArray(prodJson.data) ? prodJson.data : prodJson.data?.items ?? []
        setProducts(list.filter((p: any) => p.active !== false))
      }
      if (feesJson.success) setFees((feesJson.data ?? []).filter((f: FeeItem) => f.active !== false))
      if (setJson.success) {
        setSettings(setJson.data)
        if (setJson.data?.prorationModel) setProrationModel(setJson.data.prorationModel)
      }
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  // ── Unit selection ──
  const unitSizes = useMemo(() => Array.from(new Set(units.map((u) => u.size))), [units])
  useEffect(() => {
    if (!unitType && unitSizes.length > 0) setUnitType(unitSizes[0])
  }, [unitSizes, unitType])

  const unitsOfType = useMemo(() => units.filter((u) => u.size === unitType), [units, unitType])
  const selectedUnit = useMemo(() => {
    if (unitId === 'auto') return unitsOfType[0] ?? null
    return units.find((u) => u._id === unitId) ?? null
  }, [unitId, unitsOfType, units])

  // Default plan price + deposit to the unit's monthly price
  useEffect(() => {
    if (selectedUnit) {
      setPlanMonthlyRate(selectedUnit.price)
      setDepositAmount(selectedUnit.price)
    }
  }, [selectedUnit])

  // Default billing start = first of next month (computed in local time so the
  // YYYY-MM-DD string stays in the same calendar day the admin selected).
  useEffect(() => {
    if (!moveInDate) return
    const d = parseLocalDate(moveInDate)
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const yyyy = next.getFullYear()
    const mm = String(next.getMonth() + 1).padStart(2, '0')
    const dd = String(next.getDate()).padStart(2, '0')
    setBillingStartDate(`${yyyy}-${mm}-${dd}`)
  }, [moveInDate])

  // ── Summary computation ──
  // Promo is rendered as its own negative line ("Rent Promotion Amount") below Rent,
  // and is NOT applied to prorated rent or protection (matches the live admin).
  const summary = useMemo(() => {
    const promo = promotions.find((p) => p._id === promotionId) ?? null
    const promoDiscount = promo
      ? (promo.discountType === 'percentage'
          ? Math.max(0, Math.round(planMonthlyRate * (promo.discountValue / 100)))
          : Math.min(promo.discountValue, planMonthlyRate))
      : 0

    const plan = plans.find((p) => p._id === protectionPlanId) ?? null
    const protectionMonthly = plan?.monthlyPrice ?? 0
    const setupFee = chargeSetupFee ? (settings?.setupFeeAmount ?? 0) : 0
    const depositCharged = chargeDeposit && !depositPreviouslyPaid ? depositAmount : 0

    const feesTotal = addedFees.reduce((s, f) => s + f.amount, 0)
    const productsTotal = addedProducts.reduce((s, p) => s + p.price * p.quantity, 0)

    // Prorated chunks (always at full rate, no promo)
    let proratedRent = 0
    let proratedProtection = 0
    let secondMonthDueDate: Date | null = null
    let firstCycleRent = 0
    let firstCycleProtection = 0
    let firstCycleDate: Date | null = null

    if (moveInDate && billingStartDate) {
      const start = parseLocalDate(moveInDate)
      const billingStart = parseLocalDate(billingStartDate)

      if (prorationModel === 'first_month_full_then_prorate' || prorationModel === 'first_month_full_prorate_now') {
        const firstMonthEnd = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() - 1)
        const secondMonthStart = new Date(firstMonthEnd)
        secondMonthStart.setDate(secondMonthStart.getDate() + 1)
        const anchor = new Date(billingStart.getFullYear(), billingStart.getMonth() + 1, 1)
        const daysInSecondMonth = new Date(secondMonthStart.getFullYear(), secondMonthStart.getMonth() + 1, 0).getDate()
        const remainingDays = Math.max(
          0,
          Math.round((anchor.getTime() - secondMonthStart.getTime()) / (1000 * 60 * 60 * 24)),
        )
        if (remainingDays > 0 && remainingDays < daysInSecondMonth) {
          proratedRent = Math.round((planMonthlyRate / daysInSecondMonth) * remainingDays)
          if (plan) proratedProtection = Math.round((protectionMonthly / daysInSecondMonth) * remainingDays)
          secondMonthDueDate = prorationModel === 'first_month_full_prorate_now' ? start : billingStart
        }
      } else if (prorationModel === 'prorate_first_month') {
        const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
        const partialDays = daysInMonth - start.getDate() + 1
        proratedRent = Math.round((planMonthlyRate / daysInMonth) * partialDays)
        if (plan) proratedProtection = Math.round((protectionMonthly / daysInMonth) * partialDays)
      } else if (prorationModel === 'prorate_both') {
        const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
        const partialDays = daysInMonth - start.getDate() + 1
        proratedRent = Math.round((planMonthlyRate / daysInMonth) * partialDays)
        if (plan) proratedProtection = Math.round((protectionMonthly / daysInMonth) * partialDays)
        firstCycleRent = planMonthlyRate
        firstCycleProtection = protectionMonthly
        firstCycleDate = billingStart
      }
    }

    // Total Due today depends on the model. Promo only applies once, to the
    // first FULL-month rent line (when present). Prorated lines are always
    // billed at face value.
    let computedTotalDue = depositCharged + setupFee + feesTotal + productsTotal
    if (prorationModel === 'prorate_first_month' || prorationModel === 'prorate_both') {
      // Promo doesn't apply since there's no full-month line.
      computedTotalDue += proratedRent + proratedProtection
    } else if (prorationModel === 'custom') {
      // Admin types final amounts; promo is ignored.
      computedTotalDue += customProratedRent + (plan ? customProratedProtection : 0)
    } else {
      // none / first_month_full_then_prorate / first_month_full_prorate_now
      computedTotalDue += planMonthlyRate - promoDiscount + protectionMonthly
    }
    if (prorationModel === 'first_month_full_prorate_now') {
      computedTotalDue += proratedRent + proratedProtection
    } else if (prorationModel === 'prorate_both') {
      computedTotalDue += firstCycleRent - promoDiscount + firstCycleProtection
    }

    const ongoingMonthly = planMonthlyRate + protectionMonthly
    const ongoingStartDate = billingStartDate ? (() => {
      const d = parseLocalDate(billingStartDate)
      if (prorationModel === 'prorate_first_month') {
        // recurring starts at billingStart itself (next anchor)
        return d
      }
      d.setMonth(d.getMonth() + 1)
      return d
    })() : null

    return {
      protectionMonthly,
      depositCharged,
      setupFee,
      feesTotal,
      productsTotal,
      totalDue: computedTotalDue,
      proratedRent,
      proratedProtection,
      secondMonthDueDate,
      firstCycleRent,
      firstCycleProtection,
      firstCycleDate,
      ongoingMonthly,
      ongoingStartDate,
      protectionPlan: plan,
      promoDiscount,
      promoName: promo?.name ?? null,
    }
  }, [
    promotionId, promotions, planMonthlyRate, protectionPlanId, plans,
    chargeSetupFee, settings, chargeDeposit, depositAmount, depositPreviouslyPaid,
    addedFees, addedProducts, prorationModel, moveInDate, billingStartDate,
    customProratedRent, customProratedProtection,
  ])

  // ── Handlers ──
  function handleAddFee() {
    const fee = fees.find((f) => f.id === addedFeeId)
    if (!fee) return
    setAddedFees((arr) => [...arr, { feeId: fee.id, name: fee.name, amount: fee.amount }])
    setAddedFeeId('')
  }
  function handleAddProduct() {
    const p = products.find((x) => x._id === addedProductId)
    if (!p) return
    setAddedProducts((arr) => [...arr, { productId: p._id, name: p.name, price: p.price, quantity: 1, taxRate: p.taxRate ?? 0 }])
    setAddedProductId('')
  }

  async function handleSubmit() {
    if (!selectedUnit) { setError('Select a unit first'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        unitId: selectedUnit._id,
        // Send raw YYYY-MM-DD so the backend treats it as a calendar date
        // (avoids the UTC-midnight shift that breaks day-arithmetic in non-UTC TZs).
        moveInDate,
        billingStartDate,
        planMonthlyRate,
        promotionId: promotionId || null,
        protectionPlanId: protectionPlanId === 'decline' ? null : protectionPlanId,
        chargeDeposit,
        depositAmount,
        depositPreviouslyPaid,
        chargeSetupFee,
        exemptFromRateManagement: exemptFromRateMgmt,
        prorationModel,
        addedFees: addedFees.map((f) => ({ feeId: f.feeId, amount: f.amount })),
        addedProducts: addedProducts.map((p) => ({ productId: p.productId, quantity: p.quantity })),
        taxRate,
        agreementEmail,
        agreementText,
        customProratedRent: prorationModel === 'custom' ? customProratedRent : undefined,
        customProratedProtection: prorationModel === 'custom' ? customProratedProtection : undefined,
      }
      const res = await fetch(`/api/admin/tenants/${tenantId}/rent-unit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')
      setSuccess('Unit rented')
      router.push(`/admin/tenants/${tenantId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header — breadcrumb is rendered by the admin layout's app bar. */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ color: '#D97757', fontWeight: 700 }}>
          Rent a Unit
        </Typography>
        <Button
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          size="small"
          sx={{ bgcolor: '#B8BCC4', color: 'white', textTransform: 'none', '&:hover': { bgcolor: '#A0A4AC' } }}
        >
          Return to Customer
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card variant="outlined" sx={{ maxWidth: 560, p: 3, borderColor: '#E5E1D8' }}>
        <FieldLabel>Unit type</FieldLabel>
        <TextField select fullWidth size="small" value={unitType} onChange={(e) => { setUnitType(e.target.value); setUnitId('auto') }} sx={{ mb: 2 }}>
          {unitSizes.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>

        <FieldLabel>Unit</FieldLabel>
        <TextField select fullWidth size="small" value={unitId} onChange={(e) => setUnitId(e.target.value as any)} sx={{ mb: 2 }}>
          <MenuItem value="auto">Automatically select</MenuItem>
          {unitsOfType.map((u) => <MenuItem key={u._id} value={u._id}>{u.unitNumber}</MenuItem>)}
        </TextField>

        <FieldLabel>Start Date for Billing Cycle</FieldLabel>
        <TextField type="date" fullWidth size="small" value={billingStartDate} onChange={(e) => setBillingStartDate(e.target.value)} sx={{ mb: 2, bgcolor: '#F1EEE8' }} />

        <FieldLabel>Plan</FieldLabel>
        <TextField select fullWidth size="small" value={String(planMonthlyRate)} onChange={(e) => setPlanMonthlyRate(parseInt(e.target.value, 10))} sx={{ mb: 2 }}>
          <MenuItem value={String(planMonthlyRate)}>{formatMoney(planMonthlyRate)} Each Month</MenuItem>
        </TextField>

        <FieldLabel>Promotion</FieldLabel>
        <TextField select fullWidth size="small" value={promotionId} onChange={(e) => setPromotionId(e.target.value)} sx={{ mb: 2 }}>
          <MenuItem value="">Select a promotion</MenuItem>
          {promotions.map((p) => (
            <MenuItem key={p._id} value={p._id}>
              {p.name} ({p.discountType === 'percentage' ? `${p.discountValue}% off` : `${formatMoney(p.discountValue)} off`})
            </MenuItem>
          ))}
        </TextField>

        <FormControlLabel
          control={<Checkbox checked={exemptFromRateMgmt} onChange={(e) => setExemptFromRateMgmt(e.target.checked)} />}
          label="Exempt from Rate Management"
          sx={{ '& .MuiTypography-root': { fontSize: '0.875rem' } }}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', ml: 4, mt: -0.5, mb: 2 }}>
          When checked this rental will not be included in any rate management reminders.
        </Typography>

        <FieldLabel>Tenant protection</FieldLabel>
        <TextField select fullWidth size="small" value={protectionPlanId} onChange={(e) => setProtectionPlanId(e.target.value)} sx={{ mb: 2 }}>
          <MenuItem value="decline">Decline coverage</MenuItem>
          {plans.map((p) => (
            <MenuItem key={p._id} value={p._id}>
              {formatMoney(p.coverageAmount)} protection for {formatMoney(p.monthlyPrice)}/month
            </MenuItem>
          ))}
        </TextField>

        <FormControlLabel
          control={<Checkbox checked={chargeDeposit} onChange={(e) => setChargeDeposit(e.target.checked)} />}
          label="Charge deposit"
          sx={{ '& .MuiTypography-root': { fontSize: '0.875rem' } }}
        />
        {chargeDeposit && (
          <>
            <FieldLabel>Deposit</FieldLabel>
            <TextField
              fullWidth size="small" type="number"
              value={depositAmount / 100}
              onChange={(e) => setDepositAmount(Math.round(parseFloat(e.target.value || '0') * 100))}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              sx={{ mb: 1 }}
            />
            <FormControlLabel
              control={<Checkbox checked={depositPreviouslyPaid} onChange={(e) => setDepositPreviouslyPaid(e.target.checked)} />}
              label="Mark deposit as previously paid"
              sx={{ mb: 1, '& .MuiTypography-root': { fontSize: '0.875rem' } }}
            />
          </>
        )}

        <FormControlLabel
          control={<Checkbox checked={chargeSetupFee} onChange={(e) => setChargeSetupFee(e.target.checked)} />}
          label={`Charge Setup Fee${settings?.setupFeeAmount ? ` (${formatMoney(settings.setupFeeAmount)})` : ''}`}
          sx={{ mb: 2, '& .MuiTypography-root': { fontSize: '0.875rem' } }}
        />

        <FieldLabel>Add a fee</FieldLabel>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField select fullWidth size="small" value={addedFeeId} onChange={(e) => setAddedFeeId(e.target.value)}>
            <MenuItem value="">Select a fee</MenuItem>
            {fees.map((f) => <MenuItem key={f.id} value={f.id}>{f.name} ({formatMoney(f.amount)})</MenuItem>)}
          </TextField>
          <Button onClick={handleAddFee} disabled={!addedFeeId} variant="contained" disableElevation sx={{ bgcolor: '#3B82F6', textTransform: 'none' }}>Add</Button>
        </Box>
        {addedFees.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {addedFees.map((f, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, fontSize: '0.875rem' }}>
                <span>{f.name}</span>
                <Box>
                  <span>{formatMoney(f.amount)}</span>
                  <MuiLink component="button" type="button" onClick={() => setAddedFees((arr) => arr.filter((_, j) => j !== i))} sx={{ ml: 2, color: '#D97757' }}>Remove</MuiLink>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        <FieldLabel>Add a product</FieldLabel>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField select fullWidth size="small" value={addedProductId} onChange={(e) => setAddedProductId(e.target.value)}>
            <MenuItem value="">Select a product</MenuItem>
            {products.map((p) => <MenuItem key={p._id} value={p._id}>{p.name} ({formatMoney(p.price)})</MenuItem>)}
          </TextField>
          <Button onClick={handleAddProduct} disabled={!addedProductId} variant="contained" disableElevation sx={{ bgcolor: '#3B82F6', textTransform: 'none' }}>Add</Button>
        </Box>
        {addedProducts.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {addedProducts.map((p, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, fontSize: '0.875rem' }}>
                <span>{p.name} ×{p.quantity}</span>
                <Box>
                  <span>{formatMoney(p.price * p.quantity)}</span>
                  <MuiLink component="button" type="button" onClick={() => setAddedProducts((arr) => arr.filter((_, j) => j !== i))} sx={{ ml: 2, color: '#D97757' }}>Remove</MuiLink>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        <FieldLabel>Prorating Options</FieldLabel>
        <TextField select fullWidth size="small" value={prorationModel} onChange={(e) => setProrationModel(e.target.value as any)} sx={{ mb: 2 }}>
          <MenuItem value="none">No Prorating</MenuItem>
          <MenuItem value="custom">Custom Prorating</MenuItem>
          <MenuItem value="first_month_full_prorate_now">Bill for first full month, Prorate second month billed now</MenuItem>
          <MenuItem value="first_month_full_then_prorate">Bill for first full month, Prorate second month billed later</MenuItem>
          <MenuItem value="prorate_first_month">Prorate this month and bill full billing cycle starting next month</MenuItem>
          <MenuItem value="prorate_both">Prorate this month and bill now for the first billing cycle</MenuItem>
        </TextField>

        <FieldLabel>Move-in Date</FieldLabel>
        <TextField type="date" fullWidth size="small" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} sx={{ mb: 2 }} />

        {prorationModel === 'custom' && (
          <>
            <FieldLabel>Prorated amount</FieldLabel>
            <TextField
              fullWidth size="small" type="number"
              value={customProratedRent / 100}
              onChange={(e) => setCustomProratedRent(Math.round(parseFloat(e.target.value || '0') * 100))}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              sx={{ mb: 2 }}
            />
            {summary.protectionPlan && (
              <>
                <FieldLabel>Prorated tenant protection fee</FieldLabel>
                <TextField
                  fullWidth size="small" type="number"
                  value={customProratedProtection / 100}
                  onChange={(e) => setCustomProratedProtection(Math.round(parseFloat(e.target.value || '0') * 100))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  sx={{ mb: 2 }}
                />
              </>
            )}
          </>
        )}

        <FieldLabel>Tax rate</FieldLabel>
        <TextField select fullWidth size="small" value={String(taxRate)} onChange={(e) => setTaxRate(parseFloat(e.target.value))} sx={{ mb: 2 }}>
          <MenuItem value="0">Don&apos;t Charge Tax</MenuItem>
          {settings?.taxRate ? (
            <MenuItem value={String(settings.taxRate)}>{settings.taxRate}% (facility rate)</MenuItem>
          ) : null}
        </TextField>

        {/* Storage Agreement panel */}
        <Card variant="outlined" sx={{ mb: 3, borderColor: '#E5E1D8' }}>
          <Box sx={{ bgcolor: '#F1EEE8', px: 2, py: 1.25, borderBottom: '1px solid #E5E1D8' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Send Storage Agreement to Customers</Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              Schedule a notification to be sent using the &quot;Storage Agreement&quot; template.
            </Typography>
            <FormControlLabel
              control={<Checkbox size="small" checked={agreementEmail} onChange={(e) => setAgreementEmail(e.target.checked)} />}
              label="Email"
              sx={{ mr: 2, '& .MuiTypography-root': { fontSize: '0.875rem' } }}
            />
            <FormControlLabel
              control={<Checkbox size="small" checked={agreementText} onChange={(e) => setAgreementText(e.target.checked)} />}
              label="Text"
              sx={{ '& .MuiTypography-root': { fontSize: '0.875rem' } }}
            />
          </Box>
        </Card>

        {/* Summary table */}
        <Table size="small" sx={{ mb: 3, '& td, & th': { borderColor: '#E5E1D8' } }}>
          <TableBody>
            {/* Rent + promotion + prorated lines (order matches the live admin) */}
            {prorationModel === 'custom' ? (
              <>
                <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Prorated amount</TableCell>
                  <TableCell align="right">{formatMoney(customProratedRent)}</TableCell>
                </TableRow>
                {summary.protectionPlan && (
                  <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Prorated tenant protection fee</TableCell>
                    <TableCell align="right">{formatMoney(customProratedProtection)}</TableCell>
                  </TableRow>
                )}
              </>
            ) : prorationModel === 'prorate_first_month' ? (
              <>
                <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Prorated Rent</TableCell>
                  <TableCell align="right">{formatMoney(summary.proratedRent)}</TableCell>
                </TableRow>
                {summary.protectionPlan && (
                  <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Prorated Tenant Protection Fee</TableCell>
                    <TableCell align="right">{formatMoney(summary.proratedProtection)}</TableCell>
                  </TableRow>
                )}
              </>
            ) : prorationModel === 'prorate_both' ? (
              <>
                <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Prorated Rent</TableCell>
                  <TableCell align="right">{formatMoney(summary.proratedRent)}</TableCell>
                </TableRow>
                {summary.firstCycleRent > 0 && (
                  <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                    <TableCell sx={{ fontWeight: 700 }}>First billing cycle rent</TableCell>
                    <TableCell align="right">{formatMoney(summary.firstCycleRent)}</TableCell>
                  </TableRow>
                )}
                {summary.promoDiscount > 0 && (
                  <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Rent Promotion Amount</TableCell>
                    <TableCell align="right" sx={{ color: '#D97757' }}>({formatMoney(summary.promoDiscount)})</TableCell>
                  </TableRow>
                )}
                {summary.protectionPlan && (
                  <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Prorated Tenant Protection Fee</TableCell>
                    <TableCell align="right">{formatMoney(summary.proratedProtection)}</TableCell>
                  </TableRow>
                )}
                {summary.firstCycleProtection > 0 && (
                  <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                    <TableCell sx={{ fontWeight: 700 }}>First billing cycle protection</TableCell>
                    <TableCell align="right">{formatMoney(summary.firstCycleProtection)}</TableCell>
                  </TableRow>
                )}
              </>
            ) : (
              // none | first_month_full_then_prorate | first_month_full_prorate_now
              <>
                <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Rent</TableCell>
                  <TableCell align="right">{formatMoney(planMonthlyRate)}</TableCell>
                </TableRow>
                {summary.promoDiscount > 0 && (
                  <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Rent Promotion Amount</TableCell>
                    <TableCell align="right" sx={{ color: '#D97757' }}>({formatMoney(summary.promoDiscount)})</TableCell>
                  </TableRow>
                )}
                {prorationModel === 'first_month_full_prorate_now' && summary.proratedRent > 0 && (
                  <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Prorated Rent</TableCell>
                    <TableCell align="right">{formatMoney(summary.proratedRent)}</TableCell>
                  </TableRow>
                )}
                {summary.protectionPlan && (
                  <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Tenant Protection Fee</TableCell>
                    <TableCell align="right">{formatMoney(summary.protectionMonthly)}</TableCell>
                  </TableRow>
                )}
                {prorationModel === 'first_month_full_prorate_now' && summary.proratedProtection > 0 && (
                  <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Prorated Tenant Protection Fee</TableCell>
                    <TableCell align="right">{formatMoney(summary.proratedProtection)}</TableCell>
                  </TableRow>
                )}
              </>
            )}
            {summary.setupFee > 0 && (
              <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                <TableCell sx={{ fontWeight: 700 }}>{settings?.setupFeeName ?? 'Setup Fee'}</TableCell>
                <TableCell align="right">{formatMoney(summary.setupFee)}</TableCell>
              </TableRow>
            )}
            {chargeDeposit && (
              <TableRow sx={{ bgcolor: '#F8F5EF' }}>
                <TableCell sx={{ fontWeight: 700 }}>Deposit{depositPreviouslyPaid ? ' (previously paid)' : ''}</TableCell>
                <TableCell align="right">{formatMoney(depositAmount)}</TableCell>
              </TableRow>
            )}
            {addedFees.map((f, i) => (
              <TableRow key={`fee-${i}`}>
                <TableCell>{f.name}</TableCell>
                <TableCell align="right">{formatMoney(f.amount)}</TableCell>
              </TableRow>
            ))}
            {addedProducts.map((p, i) => (
              <TableRow key={`prod-${i}`}>
                <TableCell>{p.name} ×{p.quantity}</TableCell>
                <TableCell align="right">{formatMoney(p.price * p.quantity)}</TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: '#F1EEE8' }}>
              <TableCell sx={{ fontWeight: 700 }}>Total Due</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{formatMoney(summary.totalDue)}</TableCell>
            </TableRow>
            {/* Future-billed prorated chunks (only for first_month_full_then_prorate) */}
            {prorationModel === 'first_month_full_then_prorate' && summary.proratedRent > 0 && summary.secondMonthDueDate && (
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  Prorated second month due on {summary.secondMonthDueDate.toLocaleDateString('en-US')}
                </TableCell>
                <TableCell align="right">{formatMoney(summary.proratedRent)}</TableCell>
              </TableRow>
            )}
            {prorationModel === 'first_month_full_then_prorate' && summary.proratedProtection > 0 && summary.secondMonthDueDate && (
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  Prorated tenant protection fee due on {summary.secondMonthDueDate.toLocaleDateString('en-US')}
                </TableCell>
                <TableCell align="right">{formatMoney(summary.proratedProtection)}</TableCell>
              </TableRow>
            )}
            {summary.ongoingStartDate && (
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  Amount due every month starting {summary.ongoingStartDate.toLocaleDateString('en-US')}
                </TableCell>
                <TableCell align="right">{formatMoney(summary.ongoingMonthly)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !selectedUnit}
          disableElevation
          sx={{ bgcolor: '#3B82F6', textTransform: 'none', px: 3, '&:hover': { bgcolor: '#2563EB' } }}
        >
          {saving ? 'Renting…' : 'Rent Now'}
        </Button>
      </Card>

      <Snackbar
        open={!!success}
        autoHideDuration={3000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>
      </Snackbar>
    </Box>
  )
}
