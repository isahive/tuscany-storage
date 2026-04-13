'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

// ── Types ───────────────────────────────────────────────────────────────────

interface UnitOption { size: string; price: number }
interface PromotionOption { _id: string; name: string; discountType: 'percentage' | 'fixed'; discountValue: number }

// ── Prorating ───────────────────────────────────────────────────────────────

function prorateAmount(monthlyCents: number, moveInDate: Date, billingStartDate: Date): number {
  const year = billingStartDate.getFullYear()
  const month = billingStartDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const moveDay = moveInDate.getDate()
  const remaining = daysInMonth - moveDay + 1
  return Math.round((monthlyCents / daysInMonth) * remaining)
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function NewQuotePage() {
  // Data
  const [unitSizes, setUnitSizes] = useState<UnitOption[]>([])
  const [promotions, setPromotions] = useState<PromotionOption[]>([])
  const [loading, setLoading] = useState(true)

  // Form
  const [unitSize, setUnitSize] = useState('')
  const [monthlyRent, setMonthlyRent] = useState(0) // cents
  const [startDate, setStartDate] = useState('') // billing cycle start
  const [moveInDate, setMoveInDate] = useState(new Date().toISOString().slice(0, 10))
  const [promotionId, setPromotionId] = useState('')
  const [tenantProtection, setTenantProtection] = useState(1200) // $12/mo default
  const [chargeDeposit, setChargeDeposit] = useState(true)
  const [depositAmount, setDepositAmount] = useState('100.00')
  const [chargeSetupFee, setChargeSetupFee] = useState(false)
  const [setupFee, setSetupFee] = useState('0.00')
  const [proratingOption, setProratingOption] = useState<string>('bill_first_full_prorate_second')
  const [taxRate, setTaxRate] = useState(0) // percentage

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load unit sizes and promotions
  useEffect(() => {
    async function load() {
      try {
        const [uRes, pRes] = await Promise.all([
          fetch('/api/units?limit=500'),
          fetch('/api/promotions'),
        ])
        const [uJson, pJson] = await Promise.all([uRes.json(), pRes.json()])

        if (uJson.success) {
          // Deduplicate by size, pick lowest price for each
          const sizeMap = new Map<string, number>()
          for (const u of uJson.data?.items ?? []) {
            const existing = sizeMap.get(u.size)
            if (!existing || u.price < existing) sizeMap.set(u.size, u.price)
          }
          const opts = Array.from(sizeMap.entries())
            .map(([size, price]) => ({ size, price }))
            .sort((a, b) => a.price - b.price)
          setUnitSizes(opts)
          if (opts.length > 0) {
            setUnitSize(opts[0].size)
            setMonthlyRent(opts[0].price)
          }
        }

        if (pJson.success) {
          setPromotions(
            (pJson.data ?? []).filter((p: PromotionOption & { status: string }) => p.status === 'active')
          )
        }

        // Default start date = 1st of next month
        const now = new Date()
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        setStartDate(nextMonth.toISOString().slice(0, 10))
      } finally { setLoading(false) }
    }
    load()
  }, [])

  // When unit size changes, update rent
  function handleSizeChange(size: string) {
    setUnitSize(size)
    const found = unitSizes.find((u) => u.size === size)
    if (found) setMonthlyRent(found.price)
  }

  // Selected promotion
  const selectedPromo = promotions.find((p) => p._id === promotionId)
  const promoDiscount = useMemo(() => {
    if (!selectedPromo) return 0
    if (selectedPromo.discountType === 'fixed') return selectedPromo.discountValue
    return Math.round(monthlyRent * (selectedPromo.discountValue / 100))
  }, [selectedPromo, monthlyRent])

  const effectiveRent = Math.max(0, monthlyRent - promoDiscount)
  const rentTax = Math.round(effectiveRent * (taxRate / 100))
  const rentWithTax = effectiveRent + rentTax
  const deposit = chargeDeposit ? Math.round(parseFloat(depositAmount || '0') * 100) : 0
  const setupFeeCents = chargeSetupFee ? Math.round(parseFloat(setupFee || '0') * 100) : 0
  const protection = tenantProtection

  // Totals
  const totalDue = rentWithTax + protection + deposit + setupFeeCents

  // Proration
  const moveIn = new Date(moveInDate)
  const billingStart = new Date(startDate)
  const proratedRent = prorateAmount(effectiveRent, moveIn, billingStart)
  const proratedRentTax = Math.round(proratedRent * (taxRate / 100))
  const proratedProtection = protection > 0 ? prorateAmount(protection, moveIn, billingStart) : 0

  const recurringStart = new Date(billingStart)
  recurringStart.setMonth(recurringStart.getMonth() + 1)
  const monthlyRecurring = rentWithTax + protection

  function fmtDateShort(d: Date) {
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  }

  async function handleGeneratePDF() {
    setGenerating(true); setError(null)
    try {
      const payload = {
        unitSize,
        monthlyRent: effectiveRent,
        startDate,
        moveInDate,
        deposit,
        chargeDeposit,
        setupFee: setupFeeCents,
        chargeSetupFee,
        tenantProtection: protection,
        promotionName: selectedPromo?.name,
        promotionDiscount: promoDiscount,
        taxRate,
        proratingOption,
      }

      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to generate quote')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setGenerating(false) }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, color: '#1C0F06', fontFamily: '"Playfair Display", serif', mb: 1 }}
      >
        New Quote
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Products can be sold while renting a unit to a tenant or added separately later.
      </Typography>

      <Grid container spacing={3}>
        {/* Left column: Form */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <Grid container spacing={2.5}>
                {/* Unit type */}
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Unit type</InputLabel>
                    <Select label="Unit type" value={unitSize} onChange={(e) => handleSizeChange(e.target.value)}>
                      {unitSizes.map((u) => (
                        <MenuItem key={u.size} value={u.size}>
                          {u.size}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Start Date */}
                <Grid item xs={12}>
                  <TextField
                    label="Start Date for Billing Cycle"
                    type="date" fullWidth size="small"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* Plan (rent) */}
                <Grid item xs={12}>
                  <TextField
                    label="Plan"
                    fullWidth size="small"
                    value={(monthlyRent / 100).toFixed(2)}
                    onChange={(e) => setMonthlyRent(Math.round(parseFloat(e.target.value || '0') * 100))}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment>, endAdornment: <InputAdornment position="end">Each Month</InputAdornment> }}
                  />
                </Grid>

                {/* Promotion */}
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Promotion</InputLabel>
                    <Select label="Promotion" value={promotionId} onChange={(e) => setPromotionId(e.target.value)}>
                      <MenuItem value="">
                        <em>Select a promotion</em>
                      </MenuItem>
                      {promotions.map((p) => (
                        <MenuItem key={p._id} value={p._id}>
                          {p.name} ({p.discountType === 'percentage' ? `${p.discountValue}% off` : fmtMoney(p.discountValue) + ' off'})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Tenant Protection */}
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Tenant protection</InputLabel>
                    <Select label="Tenant protection" value={tenantProtection} onChange={(e) => setTenantProtection(Number(e.target.value))}>
                      <MenuItem value={0}>No protection</MenuItem>
                      <MenuItem value={1200}>$2,000.00 protection for $12.00/month</MenuItem>
                      <MenuItem value={1800}>$3,000.00 protection for $18.00/month</MenuItem>
                      <MenuItem value={2500}>$5,000.00 protection for $25.00/month</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Deposit */}
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Checkbox checked={chargeDeposit} onChange={(e) => setChargeDeposit(e.target.checked)} />}
                    label={<Typography variant="body2" sx={{ fontWeight: 500 }}>Charge deposit</Typography>}
                  />
                  {chargeDeposit && (
                    <TextField
                      label="Deposit" fullWidth size="small"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                      sx={{ mt: 1 }}
                    />
                  )}
                </Grid>

                {/* Setup fee */}
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Checkbox checked={chargeSetupFee} onChange={(e) => setChargeSetupFee(e.target.checked)} />}
                    label={<Typography variant="body2" sx={{ fontWeight: 500 }}>Charge Setup Fee</Typography>}
                  />
                  {chargeSetupFee && (
                    <TextField
                      label="Setup Fee" fullWidth size="small"
                      value={setupFee}
                      onChange={(e) => setSetupFee(e.target.value)}
                      InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                      sx={{ mt: 1 }}
                    />
                  )}
                </Grid>

                {/* Prorating */}
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Prorating Options</InputLabel>
                    <Select label="Prorating Options" value={proratingOption} onChange={(e) => setProratingOption(e.target.value)}>
                      <MenuItem value="bill_first_full_prorate_second">Bill for first full month, Prorate second month billed later</MenuItem>
                      <MenuItem value="prorate_first_month">Prorate first month</MenuItem>
                      <MenuItem value="no_prorate">No prorating</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Move-in date */}
                <Grid item xs={12}>
                  <TextField
                    label="Move-in Date" type="date" fullWidth size="small"
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* Tax rate */}
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Tax rate</InputLabel>
                    <Select label="Tax rate" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))}>
                      <MenuItem value={0}>Don&apos;t Charge Tax</MenuItem>
                      <MenuItem value={7}>7%</MenuItem>
                      <MenuItem value={7.5}>7.5%</MenuItem>
                      <MenuItem value={8}>8%</MenuItem>
                      <MenuItem value={8.25}>8.25%</MenuItem>
                      <MenuItem value={9.25}>9.25%</MenuItem>
                      <MenuItem value={9.75}>9.75%</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Right column: Summary + PDF button */}
        <Grid item xs={12} md={5}>
          <Card sx={{ position: 'sticky', top: 24 }}>
            <CardContent sx={{ p: 3 }}>
              {/* Line items */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="body2">Rent</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{fmtMoney(rentWithTax)}</Typography>
              </Box>

              {promoDiscount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2" sx={{ color: '#065F46' }}>Promotion ({selectedPromo?.name})</Typography>
                  <Typography variant="body2" sx={{ color: '#065F46', fontWeight: 500 }}>-{fmtMoney(promoDiscount)}</Typography>
                </Box>
              )}

              {protection > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2">Tenant Protection Fee</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{fmtMoney(protection)}</Typography>
                </Box>
              )}

              {deposit > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2">Deposit</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{fmtMoney(deposit)}</Typography>
                </Box>
              )}

              {setupFeeCents > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2">Setup Fee</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{fmtMoney(setupFeeCents)}</Typography>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Total Due</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{fmtMoney(totalDue)}</Typography>
              </Box>

              {/* Future charges */}
              {proratingOption === 'bill_first_full_prorate_second' && (
                <Box sx={{ bgcolor: '#FAF7F2', borderRadius: 1, p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      Prorated second month due on {fmtDateShort(billingStart)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>{fmtMoney(proratedRent + proratedRentTax)}</Typography>
                  </Box>
                  {protection > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        Prorated tenant protection fee due on {fmtDateShort(billingStart)}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>{fmtMoney(proratedProtection)}</Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      Amount due every month starting {fmtDateShort(recurringStart)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{fmtMoney(monthlyRecurring)}</Typography>
                  </Box>
                </Box>
              )}

              {proratingOption !== 'bill_first_full_prorate_second' && (
                <Box sx={{ bgcolor: '#FAF7F2', borderRadius: 1, p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      Amount due every month starting {fmtDateShort(billingStart)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{fmtMoney(monthlyRecurring)}</Typography>
                  </Box>
                </Box>
              )}

              <Button
                variant="contained" fullWidth disableElevation
                startIcon={<PictureAsPdfIcon />}
                onClick={handleGeneratePDF}
                disabled={generating || !unitSize}
                sx={{ py: 1.2 }}
              >
                {generating ? 'Generating...' : 'Generate Quote PDF'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
