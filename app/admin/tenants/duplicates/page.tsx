'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshIcon from '@mui/icons-material/Refresh'

type Reason = 'card' | 'name' | 'address' | 'phone' | 'email'
type Confidence = 'high' | 'medium' | 'low'

interface PairSide {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface Pair {
  a: PairSide
  b: PairSide
  reasons: Reason[]
  confidence: Confidence
}

const REASON_LABEL: Record<Reason, string> = {
  card: 'Card',
  name: 'Name',
  address: 'Address',
  phone: 'Phone',
  email: 'Email',
}

const CONFIDENCE_COLOR: Record<Confidence, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
}

export default function DuplicateTenantsPage() {
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [pairs, setPairs] = useState<Pair[]>([])
  const [scanned, setScanned] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setScanning(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/tenants/duplicates', { cache: 'no-store' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed to scan')
      setPairs(json.data.pairs)
      setScanned(json.data.scanned)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to scan')
    } finally {
      setLoading(false)
      setScanning(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const act = async (
    tenantId: string,
    targetId: string,
    endpoint: 'link' | 'dismiss-match',
  ) => {
    const key = `${tenantId}::${targetId}::${endpoint}`
    setBusyKey(key)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Action failed')
      setPairs((prev) =>
        prev.filter((p) => !(pairEquals(p, tenantId, targetId))),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h4" fontWeight={600}>
          Duplicate Tenants
        </Typography>
        <Button
          variant="outlined"
          startIcon={scanning ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={load}
          disabled={scanning}
        >
          Rescan
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Accounts that probably belong to the same person — matched by saved card,
        billing name, address, phone, or email. Link them so contact attempts
        pre-auction cover every channel. Logins for both accounts stay active.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : pairs.length === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Typography align="center" color="text.secondary" py={4}>
              No duplicates detected across {scanned.toLocaleString()} tenant{scanned === 1 ? '' : 's'}.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          <Typography variant="caption" color="text.secondary">
            {pairs.length} possible duplicate{pairs.length === 1 ? '' : 's'} across {scanned.toLocaleString()} tenants
          </Typography>
          {pairs.map((p) => {
            const key = `${p.a.id}::${p.b.id}`
            return (
              <Card key={key} variant="outlined">
                <CardContent>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    divider={<Divider orientation="vertical" flexItem />}
                  >
                    <TenantSummary side={p.a} />
                    <TenantSummary side={p.b} />
                  </Stack>

                  <Box mt={2} display="flex" flexWrap="wrap" gap={1} alignItems="center">
                    <Chip
                      size="small"
                      label={p.confidence.toUpperCase()}
                      color={CONFIDENCE_COLOR[p.confidence]}
                    />
                    {p.reasons.map((r) => (
                      <Chip key={r} size="small" variant="outlined" label={REASON_LABEL[r]} />
                    ))}
                  </Box>

                  <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<LinkIcon />}
                      onClick={() => act(p.a.id, p.b.id, 'link')}
                      disabled={busyKey?.startsWith(`${p.a.id}::${p.b.id}`)}
                    >
                      Link as same person
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      color="inherit"
                      startIcon={<CloseIcon />}
                      onClick={() => act(p.a.id, p.b.id, 'dismiss-match')}
                      disabled={busyKey?.startsWith(`${p.a.id}::${p.b.id}`)}
                    >
                      Not a duplicate
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}

function TenantSummary({ side }: { side: PairSide }) {
  const fullName = `${side.firstName ?? ''} ${side.lastName ?? ''}`.trim() || '(no name)'
  return (
    <Box flex={1} minWidth={0}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="subtitle1" fontWeight={600} noWrap>
          {fullName}
        </Typography>
        <Button
          size="small"
          variant="text"
          endIcon={<OpenInNewIcon fontSize="small" />}
          href={`/admin/tenants/${side.id}`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ minWidth: 'auto' }}
        >
          Open
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" noWrap>
        {side.email || '—'}
      </Typography>
      <Typography variant="body2" color="text.secondary" noWrap>
        {side.phone || '—'}
      </Typography>
    </Box>
  )
}

function pairEquals(p: Pair, aId: string, bId: string): boolean {
  return (
    (p.a.id === aId && p.b.id === bId) ||
    (p.a.id === bId && p.b.id === aId)
  )
}
