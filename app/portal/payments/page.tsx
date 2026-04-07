'use client'

import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  TextField,
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import DownloadIcon from '@mui/icons-material/Download'
import PaymentIcon from '@mui/icons-material/Payment'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import ReceiptIcon from '@mui/icons-material/Receipt'
import type { Payment, PaymentStatus } from '@/types'

const formatMoney = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const formatDate = (date: string | Date): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

// ─── Status chip colors ───────────────────────────────────────────────────────

const STATUS_COLORS: Record<PaymentStatus, { bg: string; color: string; label: string }> = {
  succeeded: { bg: '#D1FAE5', color: '#065F46', label: 'Paid' },
  failed:    { bg: '#FEE2E2', color: '#991B1B', label: 'Failed' },
  pending:   { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
  refunded:  { bg: '#F3F4F6', color: '#374151', label: 'Refunded' },
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_BALANCE = 16500 // $165.00 due
const MOCK_DUE_DATE = '2026-04-15'
const MOCK_AUTOPAY = true
const MOCK_CARD = { brand: 'Visa', last4: '4242', expMonth: 8, expYear: 2027 }

const MOCK_PAYMENTS: Payment[] = [
  {
    _id: 'p1', tenantId: 't1', leaseId: 'l1', unitId: 'u1',
    stripePaymentIntentId: 'pi_mock1', amount: 16500, currency: 'usd',
    type: 'rent', status: 'succeeded',
    periodStart: '2026-03-01', periodEnd: '2026-03-31',
    attemptCount: 1, receiptUrl: '#',
    createdAt: '2026-03-15T08:00:00Z', updatedAt: '2026-03-15T08:00:00Z',
  },
  {
    _id: 'p2', tenantId: 't1', leaseId: 'l1', unitId: 'u1',
    stripePaymentIntentId: 'pi_mock2', amount: 16500, currency: 'usd',
    type: 'rent', status: 'succeeded',
    periodStart: '2026-02-01', periodEnd: '2026-02-28',
    attemptCount: 1, receiptUrl: '#',
    createdAt: '2026-02-15T08:00:00Z', updatedAt: '2026-02-15T08:00:00Z',
  },
  {
    _id: 'p3', tenantId: 't1', leaseId: 'l1', unitId: 'u1',
    stripePaymentIntentId: 'pi_mock3', amount: 16500, currency: 'usd',
    type: 'rent', status: 'succeeded',
    periodStart: '2026-01-01', periodEnd: '2026-01-31',
    attemptCount: 1, receiptUrl: '#',
    createdAt: '2026-01-15T08:00:00Z', updatedAt: '2026-01-15T08:00:00Z',
  },
  {
    _id: 'p4', tenantId: 't1', leaseId: 'l1', unitId: 'u1',
    stripePaymentIntentId: 'pi_mock4', amount: 16500, currency: 'usd',
    type: 'rent', status: 'failed', failureReason: 'Insufficient funds',
    periodStart: '2025-12-01', periodEnd: '2025-12-31',
    attemptCount: 2,
    createdAt: '2025-12-15T08:00:00Z', updatedAt: '2025-12-15T08:00:00Z',
  },
  {
    _id: 'p5', tenantId: 't1', leaseId: 'l1', unitId: 'u1',
    stripePaymentIntentId: 'pi_mock5', amount: 16500, currency: 'usd',
    type: 'rent', status: 'succeeded',
    periodStart: '2025-11-01', periodEnd: '2025-11-30',
    attemptCount: 1, receiptUrl: '#',
    createdAt: '2025-11-15T08:00:00Z', updatedAt: '2025-11-15T08:00:00Z',
  },
]

// ─── Stripe Elements placeholder ─────────────────────────────────────────────

function PaymentForm({ onClose }: { onClose: () => void }) {
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)

  const handlePay = () => {
    setProcessing(true)
    // Simulate payment processing
    setTimeout(() => {
      setProcessing(false)
      setSuccess(true)
    }, 1500)
  }

  if (success) {
    return (
      <>
        <DialogContent>
          <Alert severity="success" sx={{ mt: 1 }}>
            Payment of {formatMoney(MOCK_BALANCE)} processed successfully! A receipt will be emailed to you.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="contained" onClick={onClose}>Done</Button>
        </DialogActions>
      </>
    )
  }

  return (
    <>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
          Stripe payment form — live in production
        </Alert>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Amount due: <strong>{formatMoney(MOCK_BALANCE)}</strong>
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Card number"
              fullWidth
              placeholder="4242 4242 4242 4242"
              inputProps={{ readOnly: true }}
            />
          </Grid>
          <Grid item xs={8}>
            <TextField label="Expiration" fullWidth placeholder="MM / YY" inputProps={{ readOnly: true }} />
          </Grid>
          <Grid item xs={4}>
            <TextField label="CVC" fullWidth placeholder="•••" inputProps={{ readOnly: true }} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={processing}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handlePay}
          disabled={processing}
          startIcon={<PaymentIcon />}
        >
          {processing ? 'Processing…' : `Pay ${formatMoney(MOCK_BALANCE)}`}
        </Button>
      </DialogActions>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [payOpen, setPayOpen] = useState(false)
  const [autopay, setAutopay] = useState(MOCK_AUTOPAY)

  return (
    <Box>
      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 3 }}>
        Payments
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* Current Balance */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ReceiptIcon sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle1" fontWeight={600}>Current Balance</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}>
                {formatMoney(MOCK_BALANCE)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Due {formatDate(MOCK_DUE_DATE)}
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<PaymentIcon />}
                onClick={() => setPayOpen(true)}
              >
                Pay now
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
              <FormControlLabel
                control={
                  <Switch
                    checked={autopay}
                    onChange={(e) => setAutopay(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2">
                    {autopay ? 'Autopay is enabled' : 'Autopay is disabled'}
                  </Typography>
                }
              />
              {autopay && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, ml: 0.5 }}>
                  Your card will be charged automatically on the 15th of each month.
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CreditCardIcon sx={{ color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {MOCK_CARD.brand} ••••{MOCK_CARD.last4}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Expires {MOCK_CARD.expMonth}/{MOCK_CARD.expYear}
                  </Typography>
                </Box>
                <Button size="small" sx={{ ml: 'auto' }} variant="text">
                  Update card
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Payment History */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Payment History
          </Typography>
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
                {MOCK_PAYMENTS.map((payment) => {
                  const s = STATUS_COLORS[payment.status]
                  return (
                    <TableRow key={payment._id} hover>
                      <TableCell>
                        <Typography variant="body2">{formatDate(payment.createdAt)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(payment.periodStart)} – {formatDate(payment.periodEnd)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {payment.type.replace('_', ' ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {formatMoney(payment.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={s.label}
                          size="small"
                          sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {payment.receiptUrl ? (
                          <Tooltip title="Download receipt">
                            <IconButton
                              size="small"
                              component="a"
                              href={payment.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ color: 'primary.main' }}
                            >
                              <DownloadIcon fontSize="small" />
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

      {/* Pay Now Dialog */}
      <Dialog open={payOpen} onClose={() => setPayOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>Make a Payment</DialogTitle>
        <PaymentForm onClose={() => setPayOpen(false)} />
      </Dialog>
    </Box>
  )
}
