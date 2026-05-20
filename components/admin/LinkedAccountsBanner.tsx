'use client'

import { useEffect, useState } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

interface LinkedTenant {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
}

/**
 * Banner shown on the admin tenant detail page when this tenant has been
 * confirmed as the same human as one or more other accounts. The operator
 * uses the "Open" link to jump between accounts when chasing contact
 * attempts before an auction.
 */
export default function LinkedAccountsBanner({ tenantId }: { tenantId: string }) {
  const [linked, setLinked] = useState<LinkedTenant[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/tenants/${tenantId}/linked`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) setLinked(json.data.linked)
      })
      .catch(() => {
        // Banner is supplementary — never block the page on its failure.
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  if (linked.length === 0) return null

  return (
    <Alert
      severity="info"
      icon={<LinkIcon />}
      sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Box>
          <Typography variant="body2" fontWeight={600}>
            This person {linked.length === 1 ? 'also has' : 'also has'} {linked.length}{' '}
            linked account{linked.length === 1 ? '' : 's'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Confirmed duplicate{linked.length === 1 ? '' : 's'} — use these contacts when
            documenting pre-auction outreach.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {linked.map((t) => {
            const name = `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() || 'View account'
            return (
              <Button
                key={t.id}
                size="small"
                variant="outlined"
                endIcon={<OpenInNewIcon fontSize="small" />}
                href={`/admin/tenants/${t.id}`}
              >
                {name}
              </Button>
            )
          })}
        </Stack>
      </Stack>
    </Alert>
  )
}
