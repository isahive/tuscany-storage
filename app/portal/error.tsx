'use client'

import { Box, Button, Typography } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Box sx={{ textAlign: 'center', py: 10 }}>
      <ErrorOutlineIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
        Something went wrong
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3, maxWidth: 400, mx: 'auto' }}>
        {error.message || 'An unexpected error occurred. Please try again.'}
      </Typography>
      <Button variant="contained" disableElevation onClick={reset}>
        Try again
      </Button>
    </Box>
  )
}
