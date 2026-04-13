'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

type StatusFilter = 'all' | 'active' | 'delinquent' | 'locked_out'

interface TenantLabel {
  id: string
  firstName: string
  lastName: string
  address?: string
  city?: string
  state?: string
  zip?: string
}

export default function MailingLabelsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [tenants, setTenants] = useState<TenantLabel[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/tenants?${params}`)
      const json = await res.json()
      if (!json.success) return

      const items: TenantLabel[] = (json.data?.items ?? []).map((t: Record<string, unknown>) => ({
        id: t._id as string,
        firstName: t.firstName as string,
        lastName: t.lastName as string,
        address: t.address as string | undefined,
        city: t.city as string | undefined,
        state: t.state as string | undefined,
        zip: t.zip as string | undefined,
      }))

      setTenants(items)
      setSelected(new Set())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  const toggleTenant = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelected(new Set(tenants.filter((t) => t.address).map((t) => t.id)))
  }

  const selectNone = () => {
    setSelected(new Set())
  }

  const handleGenerate = async () => {
    if (selected.size === 0) return
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/mailing-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantIds: Array.from(selected) }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to generate labels')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      alert('Failed to generate labels')
    } finally {
      setGenerating(false)
    }
  }

  const withAddress = tenants.filter((t) => t.address)

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          color: '#1C0F06',
          fontFamily: '"Playfair Display", serif',
          mb: 0.5,
        }}
      >
        Mailing Labels
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Generate printable Avery 5160 mailing labels for selected customers.
      </Typography>

      <Alert
        severity="info"
        icon={<InfoOutlinedIcon fontSize="small" />}
        sx={{ mb: 3, bgcolor: '#FAF7F2', border: '1px solid #EDE5D8', '& .MuiAlert-icon': { color: '#6B5B3E' } }}
      >
        Use Page Scaling &quot;None&quot; when printing. In Chrome, disable &quot;fit to page&quot;.
      </Alert>

      {/* Filters */}
      <Card sx={{ mb: 3, border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter Customers</InputLabel>
              <Select
                label="Filter Customers"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="delinquent">Delinquent</MenuItem>
                <MenuItem value="locked_out">Locked Out</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="outlined" onClick={selectAll}>
                Select All
              </Button>
              <Button size="small" variant="outlined" onClick={selectNone}>
                None
              </Button>
            </Box>

            <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto' }}>
              {selected.size} of {withAddress.length} selected (with address)
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Customer Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {tenants.map((tenant) => {
              const hasAddress = Boolean(tenant.address)
              const isSelected = selected.has(tenant.id)
              const addressLine = [tenant.city, tenant.state, tenant.zip].filter(Boolean).join(', ')

              return (
                <Grid item xs={12} sm={6} md={4} key={tenant.id}>
                  <Card
                    onClick={() => hasAddress && toggleTenant(tenant.id)}
                    sx={{
                      border: '1px solid',
                      borderColor: isSelected ? 'primary.main' : '#EDE5D8',
                      boxShadow: 'none',
                      borderRadius: 2,
                      cursor: hasAddress ? 'pointer' : 'default',
                      opacity: hasAddress ? 1 : 0.5,
                      bgcolor: isSelected ? '#FAF7F2' : 'white',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                      '&:hover': hasAddress
                        ? { borderColor: 'primary.main', bgcolor: '#FAF7F2' }
                        : {},
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Checkbox
                          checked={isSelected}
                          disabled={!hasAddress}
                          size="small"
                          sx={{ mt: -0.5, ml: -0.5 }}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => hasAddress && toggleTenant(tenant.id)}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1C0F06' }}>
                            {tenant.firstName} {tenant.lastName}
                          </Typography>
                          {tenant.address ? (
                            <>
                              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                {tenant.address}
                              </Typography>
                              {addressLine && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                  {addressLine}
                                </Typography>
                              )}
                            </>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#DC2626' }}>
                              No address on file
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>

          {tenants.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No tenants found for the selected filter.
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Generate Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <PrintIcon />}
          disabled={selected.size === 0 || generating}
          onClick={handleGenerate}
          disableElevation
        >
          {generating ? 'Generating...' : 'Generate Labels PDF'}
        </Button>
      </Box>
    </Box>
  )
}
