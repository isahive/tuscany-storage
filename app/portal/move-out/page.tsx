'use client'

import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CheckIcon from '@mui/icons-material/Check'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox'

const formatMoney = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const formatDate = (date: string | Date): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_LEASE = {
  unitNumber: '14B',
  monthlyRate: 16500,
  billingDay: 15,
  deposit: 16500,
  startDate: '2024-11-01',
}

// ─── Billing implications helper ──────────────────────────────────────────────

function computeImplications(moveOutDate: string) {
  if (!moveOutDate) return null

  const date = new Date(moveOutDate)
  const day = date.getDate()
  const billingDay = MOCK_LEASE.billingDay

  // Prorated amount: if move-out is before billing day, they get a refund for unused days;
  // if after, they owe for days used since billing day.
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const dailyRate = MOCK_LEASE.monthlyRate / daysInMonth

  let proratedNote: string
  let depositNote: string

  if (day < billingDay) {
    const unusedDays = billingDay - day
    const credit = Math.round(dailyRate * unusedDays)
    proratedNote = `Prorated credit of ${formatMoney(credit)} for ${unusedDays} unused days (before billing day).`
  } else if (day === billingDay) {
    proratedNote = 'Moving out on your billing day — no prorated adjustment needed.'
  } else {
    const usedDays = day - billingDay
    const owed = Math.round(dailyRate * usedDays)
    proratedNote = `Prorated charge of ${formatMoney(owed)} for ${usedDays} days used since last billing.`
  }

  depositNote = `Security deposit of ${formatMoney(MOCK_LEASE.deposit)} will be returned within 30 days after move-out inspection, less any damages.`

  return { proratedNote, depositNote }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MoveOutPage() {
  const today = new Date()
  // Minimum move-out date: 30 days from today (notice period)
  const minDate = new Date(today)
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  const [moveOutDate, setMoveOutDate] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const implications = moveOutDate ? computeImplications(moveOutDate) : null
  const canSubmit = moveOutDate.length > 0

  const handleSubmit = () => {
    setConfirmOpen(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 3 }}>
          Move-Out Notice
        </Typography>
        <Card>
          <CardContent sx={{ p: 3, textAlign: 'center' }}>
            <CheckIcon sx={{ fontSize: 64, color: '#16A34A', mb: 2 }} />
            <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif', mb: 1 }}>
              Move-Out Notice Submitted
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Your scheduled move-out date is <strong>{formatDate(moveOutDate)}</strong>. Our team will
              reach out to confirm the inspection and deposit return process.
            </Typography>
            <Alert severity="info" sx={{ textAlign: 'left', mt: 2 }}>
              Please ensure the unit is completely emptied, swept, and the lock is removed by your move-out date.
            </Alert>
          </CardContent>
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}>
        Move-Out Notice
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Submit your move-out notice for Unit {MOCK_LEASE.unitNumber}. Please give at least 1 day&apos;s notice.
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
            <CalendarMonthIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>Select Move-Out Date</Typography>
          </Box>

          <TextField
            label="Move-out date"
            type="date"
            value={moveOutDate}
            onChange={(e) => setMoveOutDate(e.target.value)}
            inputProps={{ min: minDateStr }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 240, mb: 2 }}
          />

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Earliest available date: {formatDate(minDateStr)}
          </Typography>
        </CardContent>
      </Card>

      {/* Billing Implications */}
      {implications && (
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <InfoOutlinedIcon sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>Billing Implications</Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Chip
                label={`Move-out: ${formatDate(moveOutDate)}`}
                size="small"
                sx={{ bgcolor: '#DBEAFE', color: '#1E3A5F', fontWeight: 500, mb: 2 }}
              />
            </Box>

            <List dense disablePadding>
              <ListItem disableGutters alignItems="flex-start">
                <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary="Prorated rent"
                  secondary={implications.proratedNote}
                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                  secondaryTypographyProps={{ fontSize: '0.8rem' }}
                />
              </ListItem>
              <ListItem disableGutters alignItems="flex-start">
                <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary="Security deposit"
                  secondary={implications.depositNote}
                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                  secondaryTypographyProps={{ fontSize: '0.8rem' }}
                />
              </ListItem>
            </List>

            <Divider sx={{ my: 2 }} />

            <Alert severity="warning" icon={<WarningAmberIcon />}>
              Once submitted, this notice is binding. Contact us if you need to change your move-out date.
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <MoveToInboxIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>Submit Notice</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            By submitting, you agree to vacate Unit {MOCK_LEASE.unitNumber} by the selected date and
            understand the billing implications above.
          </Typography>
          <Button
            variant="contained"
            size="large"
            disabled={!canSubmit}
            onClick={() => setConfirmOpen(true)}
            startIcon={<MoveToInboxIcon />}
          >
            Submit move-out notice
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>
          Confirm Move-Out Notice
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            You are submitting a move-out notice for <strong>Unit {MOCK_LEASE.unitNumber}</strong> with
            an effective date of <strong>{moveOutDate ? formatDate(moveOutDate) : ''}</strong>.
          </DialogContentText>
          {implications && (
            <Alert severity="info">
              {implications.proratedNote}
            </Alert>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone without contacting our office.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setConfirmOpen(false)}>Go back</Button>
          <Button variant="contained" color="primary" onClick={handleSubmit} startIcon={<CheckIcon />}>
            Confirm move-out
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
