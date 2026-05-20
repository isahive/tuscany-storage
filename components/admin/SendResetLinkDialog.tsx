'use client'

import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'

interface Props {
  open: boolean
  onClose: () => void
  tenantId: string
  tenantEmail: string
}

/**
 * Admin-driven password reset. Generates a one-time link, emails the tenant,
 * and surfaces the URL so the operator can also copy/share it manually if the
 * customer says they didn't get the email.
 */
export default function SendResetLinkDialog({ open, onClose, tenantId, tenantEmail }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    url: string
    emailed: boolean
    emailError: string | null
    expiresAt: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSend = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/send-reset-link`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || 'Failed to issue link')
        return
      }
      setResult(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — admin can select manually */
    }
  }

  const handleClose = () => {
    setResult(null)
    setError(null)
    setCopied(false)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Send Password Reset Link</DialogTitle>
      <DialogContent>
        {!result && !error && (
          <Typography variant="body2" color="text.secondary">
            We&apos;ll email a single-use reset link to{' '}
            <strong>{tenantEmail}</strong>. You&apos;ll also get the link here so you can
            share it manually if needed.
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}

        {result && (
          <Box>
            <Alert severity={result.emailed ? 'success' : 'warning'} sx={{ mb: 2 }}>
              {result.emailed
                ? `Reset email sent to ${tenantEmail}.`
                : `Email delivery failed${result.emailError ? ` (${result.emailError})` : ''}. Share the link below directly.`}
            </Alert>
            <Typography variant="caption" color="text.secondary">
              Reset link (valid until {new Date(result.expiresAt).toLocaleString()}):
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
              <TextField
                fullWidth
                size="small"
                value={result.url}
                InputProps={{ readOnly: true }}
                onFocus={(e) => e.target.select()}
              />
              <Tooltip title={copied ? 'Copied' : 'Copy link'}>
                <IconButton onClick={handleCopy} color={copied ? 'success' : 'default'}>
                  {copied ? <CheckIcon /> : <ContentCopyIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSend} variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={20} /> : 'Send reset link'}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} variant="contained">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
