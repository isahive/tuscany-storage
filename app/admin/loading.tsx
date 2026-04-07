'use client'

import { Box, Skeleton, Grid } from '@mui/material'

export default function AdminLoading() {
  return (
    <Box>
      <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Grid item xs={12} sm={6} lg={4} key={i}>
            <Skeleton variant="rounded" height={100} />
          </Grid>
        ))}
      </Grid>
      <Skeleton variant="rounded" height={300} />
    </Box>
  )
}
