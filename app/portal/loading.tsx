'use client'

import { Box, Skeleton, Grid } from '@mui/material'

export default function PortalLoading() {
  return (
    <Box>
      <Skeleton variant="text" width={180} height={36} sx={{ mb: 3 }} />
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Grid item xs={12} sm={6} md={4} key={i}>
            <Skeleton variant="rounded" height={120} />
          </Grid>
        ))}
      </Grid>
      <Skeleton variant="rounded" height={250} />
    </Box>
  )
}
