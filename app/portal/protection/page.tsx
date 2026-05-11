'use client'

import { useCallback, useEffect, useState } from 'react'
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
  DialogContentText,
  DialogTitle,
  Radio,
  Snackbar,
  Typography,
} from '@mui/material'
import ShieldIcon from '@mui/icons-material/Shield'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import CheckIcon from '@mui/icons-material/Check'

interface Plan {
  _id: string
  name: string
  coverageAmount: number
  monthlyPrice: number
  description: string
}

interface PlanData {
  currentPlanId: string | null
  currentPlan: Plan | null
  availablePlans: Plan[]
}

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

export default function ProtectionPlanPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PlanData | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/portal/protection-plan')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setData(j.data)
          setSelectedId(j.data.currentPlanId)
        } else {
          setError(j.error ?? 'Failed to load protection plan')
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/protection-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to update plan')
      setSnack(selectedId ? 'Protection plan updated.' : 'Protection plan removed.')
      setConfirmOpen(false)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!data) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 3 }}>
          Tenant Protection
        </Typography>
        <Alert severity="error">{error ?? 'No active lease found.'}</Alert>
      </Box>
    )
  }

  const isChanged = selectedId !== data.currentPlanId
  const selectedPlan = data.availablePlans.find((p) => p._id === selectedId) ?? null

  return (
    <Box>
      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}>
        Tenant Protection
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Protect your stored belongings against burglary, vandalism, fire, water, and more.
      </Typography>

      {/* Current plan card */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <ShieldIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Current Coverage
            </Typography>
          </Box>
          {data.currentPlan ? (
            <Box>
              <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}>
                {formatMoney(data.currentPlan.coverageAmount)} coverage
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatMoney(data.currentPlan.monthlyPrice)}/month &bull; {data.currentPlan.name}
              </Typography>
              {data.currentPlan.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {data.currentPlan.description}
                </Typography>
              )}
            </Box>
          ) : (
            <Alert severity="warning" sx={{ mt: 1 }}>
              You have no active protection plan. We recommend selecting one below — homeowner&apos;s
              insurance often doesn&apos;t cover items stored away from your residence.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Plan selector */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Change or add a plan
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {data.availablePlans.map((plan) => {
              const isSelected = selectedId === plan._id
              return (
                <Box
                  key={plan._id}
                  onClick={() => setSelectedId(plan._id)}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: isSelected ? 'primary.main' : 'transparent',
                    transition: 'background-color .15s, border-color .15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  <Radio checked={isSelected} size="small" />
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={600}
                      sx={{ color: isSelected ? 'secondary.main' : 'text.primary' }}
                    >
                      {formatMoney(plan.coverageAmount)} coverage
                    </Typography>
                    <Typography variant="caption" sx={{ color: isSelected ? 'secondary.main' : 'text.secondary' }}>
                      {plan.name}
                    </Typography>
                  </Box>
                  <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    sx={{ color: isSelected ? 'secondary.main' : 'text.primary' }}
                  >
                    {formatMoney(plan.monthlyPrice)}/mo
                  </Typography>
                </Box>
              )
            })}

            {/* Remove option */}
            <Box
              onClick={() => setSelectedId(null)}
              sx={{
                p: 2,
                border: '1px dashed',
                borderColor: selectedId === null ? 'error.main' : 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                color: 'text.secondary',
                '&:hover': { borderColor: 'error.main' },
              }}
            >
              <RemoveCircleOutlineIcon fontSize="small" />
              <Typography variant="body2">No protection plan</Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 3, display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              disabled={!isChanged}
              startIcon={<CheckIcon />}
              onClick={() => setConfirmOpen(true)}
            >
              Save changes
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>Confirm change</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {selectedPlan
              ? `Your protection plan will be updated to ${formatMoney(selectedPlan.coverageAmount)} coverage at ${formatMoney(selectedPlan.monthlyPrice)}/month. The change applies to your next billing cycle.`
              : 'Your protection plan will be removed. Without protection, items stored at the facility are not covered against damage or loss.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
