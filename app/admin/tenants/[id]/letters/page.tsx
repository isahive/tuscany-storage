'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EmailIcon from '@mui/icons-material/Email'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

interface TenantData {
  _id: string
  firstName: string
  lastName: string
  email: string
}

interface LeaseData {
  _id: string
  status: string
  unitId: { _id: string; unitNumber: string; size?: string } | string
}

interface TemplateData {
  _id: string
  name: string
  type: 'default' | 'custom'
  emailEnabled?: boolean
  printEnabled?: boolean
  emailContent?: string
  postcardContent?: string
}

type ContactMethod = 'email' | 'print'
type PrintFormat = 'letter' | 'postcard'
type RentalScope = 'current' | 'all'

const inputSx = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: '#D7DEE4' },
    '&:hover fieldset': { borderColor: '#8CA7BA' },
    '&.Mui-focused fieldset': { borderColor: '#5B9BC8' },
  },
}

export default function TenantTemplateLettersPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [tenant, setTenant] = useState<TenantData | null>(null)
  const [leases, setLeases] = useState<LeaseData[]>([])
  const [templates, setTemplates] = useState<TemplateData[]>([])
  const [templateId, setTemplateId] = useState('')
  const [contactMethod, setContactMethod] = useState<ContactMethod>('print')
  const [printFormat, setPrintFormat] = useState<PrintFormat>('letter')
  const [rentalScope, setRentalScope] = useState<RentalScope>('current')
  const [includeTitleHeader, setIncludeTitleHeader] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useSetAdminPageTitle('Template Letters')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [tenantRes, leasesRes, templatesRes] = await Promise.all([
          fetch(`/api/tenants/${tenantId}`),
          fetch(`/api/leases?tenantId=${tenantId}&limit=50`),
          fetch('/api/admin/templates'),
        ])
        const [tenantJson, leasesJson, templatesJson] = await Promise.all([
          tenantRes.json(),
          leasesRes.json(),
          templatesRes.json(),
        ])

        if (!tenantJson.success) throw new Error(tenantJson.error ?? 'Customer not found')
        if (cancelled) return

        setTenant(tenantJson.data)
        setLeases(leasesJson.success ? leasesJson.data?.items ?? [] : [])
        const loadedTemplates = templatesJson.success ? templatesJson.data ?? [] : []
        setTemplates(loadedTemplates)
        const first = loadedTemplates.find((template: TemplateData) => template.type === 'custom') ?? loadedTemplates[0]
        if (first) setTemplateId(first._id)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load template letters')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tenantId])

  const customerName = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : ''
  const currentLease = useMemo(
    () => leases.find((lease) => lease.status === 'active' || lease.status === 'pending_moveout') ?? leases[0],
    [leases],
  )

  async function handleSubmit() {
    setError(null)
    setSuccess(null)
    if (!templateId) {
      setError('Please select a notification template.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/template-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          contactMethod,
          printFormat,
          leaseId: rentalScope === 'current' ? currentLease?._id : undefined,
          includeTemplateTitleHeader: includeTitleHeader,
        }),
      })

      if (contactMethod === 'print' && res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'template-letter.pdf'
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        setSuccess('PDF generated.')
        return
      }

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Request failed')
      setSuccess('Email sent successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template letter failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 500, px: 0, minWidth: 0 }}
        >
          Customer
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 700, color: '#2C3826' }}>
            Template Letters
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {customerName}
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          disableElevation
          sx={{ bgcolor: '#8CA7BA', '&:hover': { bgcolor: '#7894A8' }, textTransform: 'none', fontWeight: 700 }}
        >
          Return to Customer
        </Button>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>}

      <Card sx={{ maxWidth: 760, border: '1px solid #D7DEE4', boxShadow: 'none', borderRadius: 1 }}>
        <CardContent sx={{ p: 3 }}>
          <TextField
            select
            fullWidth
            label="Notification template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            sx={{ ...inputSx, mb: 3 }}
          >
            {templates.map((template) => (
              <MenuItem key={template._id} value={template._id}>
                {template.name}
              </MenuItem>
            ))}
          </TextField>

          <FormControl sx={{ mb: 2.5 }}>
            <FormLabel sx={{ color: '#2C3826', mb: 0.5 }}>Contact method</FormLabel>
            <RadioGroup value={contactMethod} onChange={(event) => setContactMethod(event.target.value as ContactMethod)}>
              <FormControlLabel value="email" control={<Radio size="small" />} label="Email" />
              <FormControlLabel value="print" control={<Radio size="small" />} label="Print" />
            </RadioGroup>
          </FormControl>

          {contactMethod === 'print' && (
            <TextField
              select
              fullWidth
              label="Print Format"
              value={printFormat}
              onChange={(event) => setPrintFormat(event.target.value as PrintFormat)}
              sx={{ ...inputSx, mb: 3 }}
            >
              <MenuItem value="letter">Letter (#10 Envelope)</MenuItem>
              <MenuItem value="postcard">Postcard</MenuItem>
            </TextField>
          )}

          <TextField
            select
            fullWidth
            label="Concerning Rental of"
            value={rentalScope}
            onChange={(event) => setRentalScope(event.target.value as RentalScope)}
            sx={{ ...inputSx, mb: 2.5 }}
          >
            <MenuItem value="current">Current Rentals</MenuItem>
            <MenuItem value="all">All Rentals</MenuItem>
          </TextField>

          {contactMethod === 'print' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeTitleHeader}
                  onChange={(event) => setIncludeTitleHeader(event.target.checked)}
                  sx={{ color: '#5B9BC8', '&.Mui-checked': { color: '#5B9BC8' } }}
                />
              }
              label="Include Template Title Header"
              sx={{ mb: 2 }}
            />
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
            <Button
              variant="contained"
              startIcon={submitting ? <CircularProgress size={16} sx={{ color: 'white' }} /> : contactMethod === 'email' ? <EmailIcon /> : <PictureAsPdfIcon />}
              onClick={handleSubmit}
              disabled={submitting || !templateId}
              disableElevation
              sx={{
                bgcolor: '#5B9BC8',
                '&:hover': { bgcolor: '#4B86AE' },
                '&.Mui-disabled': { bgcolor: '#9BBBD2', color: 'white' },
                textTransform: 'none',
                fontWeight: 700,
              }}
            >
              {submitting ? 'Working...' : contactMethod === 'email' ? 'Send Email' : 'Generate PDF'}
            </Button>
            <Button
              onClick={() => router.push(`/admin/tenants/${tenantId}`)}
              sx={{ color: '#1689A6', textTransform: 'none' }}
            >
              Cancel
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
