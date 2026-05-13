'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  InputAdornment,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { formatMoney } from '@/lib/utils'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

export default function AddCreditPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [tenant, setTenant] = useState<{ firstName: string; lastName: string; balance: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [amountInput, setAmountInput] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useSetAdminPageTitle('Add Credit')

  const loadTenant = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenants/${tenantId}`)
      const json = await res.json()
      if (json.success) {
        setTenant({
          firstName: json.data.firstName,
          lastName: json.data.lastName,
          balance: json.data.balance ?? 0,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { loadTenant() }, [loadTenant])

  // Derive Outstanding / Credit / Balance from the signed balance
  const outstandingCents = tenant ? Math.max(0, tenant.balance) : 0
  const creditCents = tenant ? Math.max(0, -tenant.balance) : 0
  const balanceCents = tenant?.balance ?? 0

  async function handleSave() {
    setErrorMsg(null)
    const parsedDollars = parseFloat(amountInput)
    if (!parsedDollars || parsedDollars <= 0) {
      setErrorMsg('Enter a positive credit amount.')
      return
    }
    const amountCents = Math.round(parsedDollars * 100)

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountCents, description: description || undefined }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to add credit')
      setSuccessMsg(`Credit of ${formatMoney(amountCents)} applied.`)
      setAmountInput('')
      setDescription('')
      loadTenant()
      // Auto-return after a moment
      setTimeout(() => router.push(`/admin/tenants/${tenantId}`), 1200)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to add credit')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#8CA87C' }} />
      </Box>
    )
  }

  if (!tenant) {
    return (
      <Alert severity="error">Customer not found</Alert>
    )
  }

  const fullName = `${tenant.firstName} ${tenant.lastName}`

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
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Playfair Display", serif' }}>
          Add Credit — {fullName}
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '380px 1fr' }, gap: 3 }}>
        {/* Form (left) */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Amount</Typography>
            <TextField
              fullWidth
              size="small"
              type="number"
              inputProps={{ min: '0', step: '0.01' }}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              sx={{ mb: 3 }}
            />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Description</Typography>
            <TextField
              fullWidth
              multiline
              minRows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              sx={{ mb: 3 }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                disableElevation
                sx={{
                  bgcolor: '#3B82F6',
                  '&:hover': { bgcolor: '#2563EB' },
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Link
                href={`/admin/tenants/${tenantId}`}
                style={{ color: '#1d4ed8', textDecoration: 'none', fontSize: '0.9rem' }}
              >
                Cancel
              </Link>
            </Box>
          </CardContent>
        </Card>

        {/* Balance table (right) */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F3F4F6', borderBottom: '2px solid #E5E7EB' } }}>
                  <TableCell>Name</TableCell>
                  <TableCell align="right">Outstanding</TableCell>
                  <TableCell align="right">Credit</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Typography
                      variant="body2"
                      component={Link}
                      href={`/admin/tenants/${tenantId}`}
                      sx={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 500 }}
                    >
                      {fullName}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ color: outstandingCents > 0 ? '#DC2626' : 'text.primary', fontWeight: outstandingCents > 0 ? 600 : 400 }}>
                      {formatMoney(outstandingCents)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ color: creditCents > 0 ? '#059669' : 'text.primary', fontWeight: creditCents > 0 ? 600 : 400 }}>
                      {formatMoney(creditCents)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {balanceCents >= 0 ? formatMoney(balanceCents) : `-${formatMoney(-balanceCents)}`}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Box>

      <Snackbar
        open={Boolean(successMsg)}
        autoHideDuration={2200}
        onClose={() => setSuccessMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      </Snackbar>
      <Snackbar
        open={Boolean(errorMsg)}
        autoHideDuration={4000}
        onClose={() => setErrorMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
