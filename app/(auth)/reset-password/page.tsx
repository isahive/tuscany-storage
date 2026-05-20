'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from '@/lib/theme'

type LinkStatus = 'checking' | 'valid' | 'expired' | 'used' | 'unknown' | 'missing'

function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [status, setStatus] = useState<LinkStatus>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('missing')
      return
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setStatus(json.status as LinkStatus)
        else setStatus('unknown')
      })
      .catch(() => setStatus('unknown'))
  }, [token])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Failed to reset password.')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Typography
            variant="h5"
            sx={{
              fontFamily: '"Playfair Display", serif',
              color: 'secondary.main',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            Tuscany Village Self Storage
          </Typography>
        </Box>

        <Card sx={{ width: '100%', maxWidth: 420 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography
              variant="h5"
              component="h1"
              sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 2 }}
            >
              Set a new password
            </Typography>

            {status === 'checking' && (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress />
              </Box>
            )}

            {status === 'missing' && (
              <Alert severity="error">No reset token in this link.</Alert>
            )}

            {(status === 'expired' || status === 'used' || status === 'unknown') && (
              <>
                <Alert severity="error" sx={{ mb: 2 }}>
                  {status === 'expired'
                    ? 'This reset link has expired.'
                    : status === 'used'
                    ? 'This reset link has already been used.'
                    : 'This reset link is not valid.'}
                </Alert>
                <Link href="/forgot-password" style={{ textDecoration: 'none' }}>
                  <Button fullWidth variant="contained" color="primary">
                    Request a new link
                  </Button>
                </Link>
              </>
            )}

            {status === 'valid' && !done && (
              <>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                  </Alert>
                )}
                <form onSubmit={handleSubmit} noValidate>
                  <TextField
                    label="New password"
                    type="password"
                    fullWidth
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={{ mb: 2 }}
                    helperText="At least 8 characters."
                  />
                  <TextField
                    label="Confirm new password"
                    type="password"
                    fullWidth
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    sx={{ mb: 3 }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    size="large"
                    disabled={loading}
                  >
                    {loading ? <CircularProgress size={22} color="inherit" /> : 'Update password'}
                  </Button>
                </form>
              </>
            )}

            {done && (
              <Alert severity="success">
                Your password has been updated. Redirecting to sign in…
              </Alert>
            )}

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Link href="/login" style={{ textDecoration: 'none' }}>
                <Typography variant="caption" color="primary">
                  Back to sign in
                </Typography>
              </Link>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </ThemeProvider>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  )
}
