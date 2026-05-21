'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Typography,
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import EmailIcon from '@mui/icons-material/Email'
import SmsIcon from '@mui/icons-material/Sms'
import ReplyIcon from '@mui/icons-material/Reply'

interface ReceiptData {
  tenant: { firstName: string; lastName: string; email: string; phone: string }
  unitNumber: string
  balance: number
  template: {
    subject: string
    emailHtml: string
    emailHtmlWrapped: string
    smsBody: string
    emailEnabled: boolean
    textEnabled: boolean
  } | null
}

function MoveOutReceiptInner() {
  const router = useRouter()
  const params = useParams()
  const search = useSearchParams()
  const tenantId = params.id as string
  const moveOutId = search.get('moveOutId')

  const [data, setData] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<'email' | 'text' | 'pdf' | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })

  useEffect(() => {
    if (!moveOutId) {
      setError('Missing move-out reference.')
      setLoading(false)
      return
    }
    fetch(`/api/move-out/${moveOutId}/receipt`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) throw new Error(j.error ?? 'Failed to load receipt')
        setData(j.data)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [moveOutId])

  async function handleSend(channel: 'email' | 'text') {
    if (!moveOutId) return
    setSending(channel)
    try {
      const res = await fetch(`/api/move-out/${moveOutId}/receipt/${channel}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to send')
      setSnackbar({ open: true, message: channel === 'email' ? 'Receipt sent via email.' : 'Receipt sent via text.', severity: 'success' })
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'Failed to send', severity: 'error' })
    } finally {
      setSending(null)
    }
  }

  async function handlePdf() {
    if (!moveOutId) return
    setSending('pdf')
    try {
      const res = await fetch(`/api/move-out/${moveOutId}/receipt/pdf`)
      if (!res.ok) throw new Error('Failed to generate PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `move-out-receipt-${moveOutId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'Failed to generate PDF', severity: 'error' })
    } finally {
      setSending(null)
    }
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }

  if (error || !data) {
    return <Alert severity="error">{error ?? 'Failed to load receipt'}</Alert>
  }

  const tenantName = `${data.tenant.firstName} ${data.tenant.lastName}`.trim()

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#9A3412', mb: 1 }}>
            Unit {data.unitNumber} Move Out Receipt
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: 14 }}>
            <Link href="/admin" style={{ color: '#3B82F6' }}>Home</Link>
            <span>/</span>
            <Link href={`/admin/tenants`} style={{ color: '#3B82F6' }}>Customers</Link>
            <span>/</span>
            <Link href={`/admin/tenants/${tenantId}`} style={{ color: '#3B82F6' }}>{tenantName}</Link>
            <span>/</span>
            <span>Unit {data.unitNumber} Move Out Receipt</span>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<EmailIcon />}
            disabled={sending !== null || !data.tenant.email || !data.template?.emailEnabled}
            onClick={() => handleSend('email')}
            sx={{ textTransform: 'none', bgcolor: '#6B7280', '&:hover': { bgcolor: '#4B5563' } }}
          >
            {sending === 'email' ? 'Sending…' : 'Send as Email'}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<SmsIcon />}
            disabled={sending !== null || !data.tenant.phone || !data.template?.textEnabled}
            onClick={() => handleSend('text')}
            sx={{ textTransform: 'none', bgcolor: '#6B7280', '&:hover': { bgcolor: '#4B5563' } }}
          >
            {sending === 'text' ? 'Sending…' : 'Send as Text'}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<PictureAsPdfIcon />}
            disabled={sending !== null}
            onClick={handlePdf}
            sx={{ textTransform: 'none', bgcolor: '#6B7280', '&:hover': { bgcolor: '#4B5563' } }}
          >
            {sending === 'pdf' ? 'Generating…' : 'PDF'}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<ReplyIcon />}
            onClick={() => router.push(`/admin/tenants/${tenantId}`)}
            sx={{ textTransform: 'none', bgcolor: '#6B7280', '&:hover': { bgcolor: '#4B5563' } }}
          >
            Return to Customer
          </Button>
        </Box>
      </Box>

      <Alert severity="success" sx={{ mb: 2, bgcolor: '#D1FAE5', color: '#065F46', '& .MuiAlert-icon': { color: '#065F46' } }}>
        Move out is complete.
      </Alert>

      {!data.template && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The &ldquo;Move Out Receipt&rdquo; template has not been seeded. Visit{' '}
          <Link href="/admin/communications/templates" style={{ color: '#9A3412', textDecoration: 'underline' }}>
            Communications &rarr; Templates
          </Link>{' '}
          to seed it.
        </Alert>
      )}

      {data.template && (
        <Box sx={{ border: '1px solid #E5E7EB', borderRadius: 1, bgcolor: '#FFFFFF', overflow: 'hidden', maxWidth: 720 }}>
          <Box sx={{ borderBottom: '1px solid #E5E7EB', bgcolor: '#F3F4F6', px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Email Message</Typography>
            <Link
              href="/admin/communications/templates"
              style={{ color: '#3B82F6', fontSize: 13, textDecoration: 'underline' }}
            >
              Edit template
            </Link>
          </Box>
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #F3F4F6', fontSize: 13, color: 'text.secondary' }}>
            <strong>Subject:</strong> {data.template.subject}
          </Box>
          <Box
            sx={{ px: 3, py: 3, fontSize: 14, lineHeight: 1.7, color: '#1C0F06', '& p': { mt: 0, mb: 1.5 } }}
            dangerouslySetInnerHTML={{ __html: data.template.emailHtml }}
          />
        </Box>
      )}

      {data.template?.smsBody && (
        <Box sx={{ mt: 3, border: '1px solid #E5E7EB', borderRadius: 1, bgcolor: '#FFFFFF', overflow: 'hidden', maxWidth: 720 }}>
          <Box sx={{ borderBottom: '1px solid #E5E7EB', bgcolor: '#F3F4F6', px: 2, py: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Text Message</Typography>
          </Box>
          <Box sx={{ px: 3, py: 2.5, fontSize: 14, lineHeight: 1.6, color: '#1C0F06', whiteSpace: 'pre-line' }}>
            {data.template.smsBody}
          </Box>
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default function MoveOutReceiptPage() {
  return (
    <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}>
      <MoveOutReceiptInner />
    </Suspense>
  )
}
