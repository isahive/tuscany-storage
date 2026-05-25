'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { formatMoney, formatDate } from '@/lib/utils'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

const BTN_PRIMARY = '#8CA87C'
const BTN_PRIMARY_HOVER = '#7E9770'

type RecurringFee = {
  _id: string
  category?: string
  customCategory?: string
  startDate: string
  interval: 'monthly' | 'yearly'
  amount: number
  taxRate: number
  chargeOnDueDate: boolean
  description?: string
  active: boolean
  createdAt: string
}

export default function RecurringFeesPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [fees, setFees] = useState<RecurringFee[]>([])
  const [tenantName, setTenantName] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useSetAdminPageTitle('Recurring Fees')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, fRes] = await Promise.all([
        fetch(`/api/tenants/${tenantId}`),
        fetch(`/api/tenants/${tenantId}/recurring-fees`),
      ])
      const [tJson, fJson] = await Promise.all([tRes.json(), fRes.json()])
      if (tJson.success) setTenantName(`${tJson.data.firstName} ${tJson.data.lastName}`)
      if (fJson.success) setFees(fJson.data)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function handleDelete(feeId: string) {
    if (!confirm('Remove this recurring fee?')) return
    const res = await fetch(`/api/tenants/${tenantId}/recurring-fees/${feeId}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) {
      setToast(json.error || 'Failed to remove')
      return
    }
    setToast('Recurring fee removed.')
    load()
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
      {/* Header — admin layout already renders the breadcrumb. */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Back
        </Button>
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: '#2C3826', fontFamily: 'var(--font-outfit), system-ui, sans-serif', flex: 1 }}
        >
          Recurring Fees{tenantName ? ` — ${tenantName}` : ''}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => router.push(`/admin/tenants/${tenantId}/fees-products`)}
          sx={{ textTransform: 'none' }}
        >
          One Time Fees/Products
        </Button>
      </Box>

      <Card sx={{ p: 3 }}>
        {fees.length === 0 ? (
          <>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
              No recurring fees have been created for this customer.
            </Typography>
            <Button
              variant="contained"
              disableElevation
              onClick={() => router.push(`/admin/tenants/${tenantId}/recurring-fees/new`)}
              sx={{
                bgcolor: BTN_PRIMARY, color: 'white', textTransform: 'none', fontWeight: 600,
                '&:hover': { bgcolor: BTN_PRIMARY_HOVER },
              }}
            >
              Add Recurring Fee
            </Button>
          </>
        ) : (
          <>
            <TableContainer sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' } }}>
                    <TableCell>Category</TableCell>
                    <TableCell>Start Date</TableCell>
                    <TableCell>Interval</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Tax</TableCell>
                    <TableCell>Auto-charge</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fees.map((f) => (
                    <TableRow key={f._id}>
                      <TableCell>{f.customCategory || f.category || '—'}</TableCell>
                      <TableCell>{formatDate(f.startDate)}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{f.interval}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>{formatMoney(f.amount)}</TableCell>
                      <TableCell align="right">
                        {f.taxRate > 0 ? `${f.taxRate}%` : <Typography variant="caption" color="text.secondary">No tax</Typography>}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={f.chargeOnDueDate ? 'Yes' : 'No'}
                          size="small"
                          sx={{
                            bgcolor: f.chargeOnDueDate ? '#D1FAE5' : '#F3F4F6',
                            color: f.chargeOnDueDate ? '#065F46' : '#374151',
                            fontWeight: 600, fontSize: '0.7rem',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        {f.description || '—'}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleDelete(f._id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Button
              variant="contained"
              disableElevation
              onClick={() => router.push(`/admin/tenants/${tenantId}/recurring-fees/new`)}
              sx={{
                bgcolor: BTN_PRIMARY, color: 'white', textTransform: 'none', fontWeight: 600,
                '&:hover': { bgcolor: BTN_PRIMARY_HOVER },
              }}
            >
              Add Recurring Fee
            </Button>
          </>
        )}
      </Card>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
