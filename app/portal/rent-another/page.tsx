'use client'

import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import { useRouter } from 'next/navigation'

interface UnitOption {
  _id: string
  unitNumber: string
  size: string
  sqft: number
  type: string
  floor: string
  price: number
  features: string[]
}

const TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up: 'Drive-Up',
  vehicle_outdoor: 'Vehicle Storage',
}

const formatMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)

export default function RentAnotherPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [units, setUnits] = useState<UnitOption[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portal/available-units')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setUnits(j.data)
        else setError(j.error ?? 'Failed to load available units')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Box>
      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}>
        Rent Another Unit
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Add storage capacity to your account. We&apos;ll pre-fill your contact and billing info — you only need to sign and pay.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
          <CircularProgress />
        </Box>
      ) : units.length === 0 ? (
        <Card>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <WarehouseIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif', mb: 1 }}>
              No units currently available
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: 'auto' }}>
              All our units are occupied at the moment. Join the waiting list and we&apos;ll notify you the
              moment a unit matching your preference opens up.
            </Typography>
            <Button variant="contained" href="/waiting-list">
              Join Waiting List
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {units.map((u) => (
            <Grid item xs={12} sm={6} md={4} key={u._id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ p: 3, flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main' }}>
                        {u.size}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Unit {u.unitNumber} &bull; {u.sqft} sq ft
                      </Typography>
                    </Box>
                    <Chip label="Available" size="small" sx={{ bgcolor: '#D1FAE5', color: '#065F46' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: 'primary.dark', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    {TYPE_LABELS[u.type] ?? u.type}
                  </Typography>

                  {u.features.length > 0 && (
                    <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {u.features.slice(0, 3).map((f) => (
                        <Chip key={f} label={f} size="small" variant="outlined" />
                      ))}
                    </Box>
                  )}

                  <Box sx={{ mt: 2.5, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="h5" component="span" sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main' }}>
                      {formatMoney(u.price)}
                    </Typography>
                    <Typography variant="body2" component="span" sx={{ ml: 0.5, color: 'text.secondary' }}>
                      /mo
                    </Typography>
                  </Box>
                </CardContent>
                <Box sx={{ p: 2, pt: 0 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => router.push(`/reserve/${u._id}`)}
                  >
                    Rent this unit
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}
