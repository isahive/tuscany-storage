'use client'

import { useState } from 'react'
import Link from 'next/link'
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 429) {
        setError('Too many attempts — please try again in a few minutes.')
        return
      }
      setSubmitted(true)
    } catch {
      // Always look like success so we don't expose whether an email exists.
      setSubmitted(true)
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
              sx={{ fontFamily: '"Playfair Display", serif', color: 'secondary.main', mb: 0.5 }}
            >
              Forgot your password?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your email and we'll send you a link to set a new one.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            {submitted ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                If an account exists for <strong>{email}</strong>, we just sent a reset link.
                Check your inbox (and spam folder).
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <TextField
                  label="Email address"
                  type="email"
                  fullWidth
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Send reset link'}
                </Button>
              </form>
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
