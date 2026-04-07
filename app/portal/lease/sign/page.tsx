'use client'

import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DownloadIcon from '@mui/icons-material/Download'
import SignatureCanvas from '@/components/shared/SignatureCanvas'
import { formatMoney, formatDate } from '@/lib/utils'

const STEPS = ['Review Lease', 'Sign', 'Confirmation']

const MOCK_LEASE = {
  id: 'lease-1',
  unitNumber: '14B',
  unitSize: '10x10',
  unitType: 'Climate Controlled',
  monthlyRate: 12500,
  deposit: 12500,
  startDate: '2026-04-15',
  billingDay: 15,
  tenantName: 'Emily Johnson',
}

export default function LeaseSignPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const lease = MOCK_LEASE

  const handleSign = async () => {
    if (!signatureData) return
    setSubmitting(true)
    // TODO: call POST /api/leases/[id]/sign with { signatureData }
    await new Promise((r) => setTimeout(r, 1500))
    setSubmitting(false)
    setActiveStep(2)
  }

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Lease Agreement
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step 0: Review */}
      {activeStep === 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Lease Summary
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {[
              { label: 'Tenant', value: lease.tenantName },
              { label: 'Unit', value: `${lease.unitNumber} — ${lease.unitSize} ${lease.unitType}` },
              { label: 'Monthly Rate', value: formatMoney(lease.monthlyRate) },
              { label: 'Security Deposit', value: formatMoney(lease.deposit) },
              { label: 'Start Date', value: formatDate(lease.startDate) },
              { label: 'Billing Day', value: `${lease.billingDay}th of each month` },
              { label: 'Lease Type', value: 'Month-to-Month' },
            ].map(({ label, value }) => (
              <Box key={label} sx={{ display: 'flex', py: 0.75 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', width: 160, flexShrink: 0 }}>
                  {label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {value}
                </Typography>
              </Box>
            ))}

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, lineHeight: 1.6 }}>
              By signing this lease agreement, you agree to the terms and conditions of Tuscany Village
              Self Storage, including the monthly rental rate, payment schedule, and facility rules.
              This lease is month-to-month and may be terminated by either party with 30 days written notice.
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="contained" disableElevation onClick={() => setActiveStep(1)}>
                Continue to Sign
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Sign */}
      {activeStep === 1 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Electronic Signature
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Please draw your signature in the box below using your mouse or finger.
            </Typography>

            <SignatureCanvas onSignatureChange={setSignatureData} />

            {!signatureData && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Please sign above to continue.
              </Alert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button onClick={() => setActiveStep(0)} sx={{ color: 'text.secondary' }}>
                Back
              </Button>
              <Button
                variant="contained"
                disableElevation
                disabled={!signatureData || submitting}
                onClick={handleSign}
              >
                {submitting ? 'Submitting...' : 'Sign Lease Agreement'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Confirmation */}
      {activeStep === 2 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              Lease Signed Successfully
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, maxWidth: 400, mx: 'auto' }}>
              Your lease agreement for Unit {lease.unitNumber} has been signed and is now active.
              A copy has been sent to your email.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                href="#"
              >
                Download PDF
              </Button>
              <Button variant="contained" disableElevation href="/portal">
                Go to Dashboard
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
