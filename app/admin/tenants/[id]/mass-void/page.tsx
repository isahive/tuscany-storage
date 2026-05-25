'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { formatDate, formatMoney } from '@/lib/utils'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

type LineItem = {
  id: string
  dateCreated: string
  amount: number
  taxRate: number
  description: string
  type: string
}

export default function MassVoidPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [tenantName, setTenantName] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useSetAdminPageTitle('Mass Void Unpaid Line Items')

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
        const init: Record<string, boolean> = {}
        for (const it of oJson.data.items) init[it.id] = false
        setSelected(init)
      }
      if (tJson.success) setTenantName(`${tJson.data.firstName} ${tJson.data.lastName}`)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  function selectAll(value: boolean) {
    const next: Record<string, boolean> = {}
    for (const it of items) next[it.id] = value
    setSelected(next)
  }

  const selectedIds = items.filter((i) => selected[i.id]).map((i) => i.id)
  const selectedTotalCents = items.reduce(
    (sum, i) => (selected[i.id] ? sum + i.amount + Math.round(i.amount * (i.taxRate / 100)) : sum),
    0,
  )

  async function handleVoid() {
    if (selectedIds.length === 0) {
      setErrorMsg('Select at least one line item to void')
      return
    }
    const confirmed = window.confirm(
      `Void ${selectedIds.length} line item${selectedIds.length > 1 ? 's' : ''} totaling ${formatMoney(selectedTotalCents)}? This cannot be undone.`,
    )
    if (!confirmed) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/void-line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: selectedIds }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Void failed')
      setSuccessMsg(`Voided ${json.data.voidedCount} line item${json.data.voidedCount > 1 ? 's' : ''}`)
      setTimeout(() => router.push(`/admin/tenants/${tenantId}`), 1200)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Void failed')
    } finally {
      setSubmitting(false)
    }
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Back to Customer
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'var(--font-outfit), system-ui, sans-serif', flex: 1 }}>
          Mass Void Unpaid Line Items — {tenantName}
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ px: 3, py: 2, bgcolor: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Unpaid Line Items</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Voiding cancels the charge and records a matching void entry in the billing history.
            </Typography>
          </Box>

          {items.length === 0 ? (
            <Box sx={{ px: 3, py: 4 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No outstanding items to void.
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
                    <TableCell padding="checkbox">Void</TableCell>
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
                            sx={{ '&.Mui-checked': { color: '#DC2626' } }}
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
                    <TableCell colSpan={6} align="right" sx={{ fontWeight: 700 }}>Selected total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatMoney(selectedTotalCents)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Box sx={{ p: 3, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleVoid}
                  disabled={submitting || selectedIds.length === 0}
                  disableElevation
                  sx={{ bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' }, textTransform: 'none', fontWeight: 600 }}
                >
                  {submitting ? 'Voiding…' : 'Void Selected Line Items'}
                </Button>
                <Button onClick={() => router.push(`/admin/tenants/${tenantId}`)} sx={{ color: 'text.secondary', textTransform: 'none' }}>
                  Cancel
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      <Snackbar open={Boolean(successMsg)} autoHideDuration={2500} onClose={() => setSuccessMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>
      </Snackbar>
      <Snackbar open={Boolean(errorMsg)} autoHideDuration={4500} onClose={() => setErrorMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setErrorMsg(null)}>{errorMsg}</Alert>
      </Snackbar>
    </Box>
  )
}
