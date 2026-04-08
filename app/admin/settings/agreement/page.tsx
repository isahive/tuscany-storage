'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Snackbar,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import VisibilityIcon from '@mui/icons-material/Visibility'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SettingsData {
  agreementTemplate: string
  facilityName: string
  [key: string]: unknown
}

// ── Placeholder definitions ───────────────────────────────────────────────────

interface PlaceholderDef {
  token: string
  label: string
}

interface PlaceholderGroup {
  category: string
  items: PlaceholderDef[]
}

const PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
  {
    category: 'Tenant',
    items: [
      { token: 'CUSTOMER_NAME', label: 'Name' },
      { token: 'CUSTOMER_ADDRESS', label: 'Address' },
      { token: 'CUSTOMER_PHONE_NUMBER', label: 'Phone' },
      { token: 'EMAIL_ADDRESS', label: 'Email' },
      { token: 'CUSTOMER_USERNAME', label: 'Username' },
    ],
  },
  {
    category: 'Unit',
    items: [
      { token: 'UNIT', label: 'Unit #' },
      { token: 'UNIT_SIZE', label: 'Size' },
      { token: 'RENT', label: 'Rent' },
      { token: 'DEPOSIT', label: 'Deposit' },
      { token: 'CUSTOMER_ACCESS_CODE', label: 'Access Code' },
    ],
  },
  {
    category: 'Agreement',
    items: [
      { token: 'DATE', label: 'Date' },
      { token: 'BALANCE', label: 'Balance' },
      { token: 'FACILITY_NAME', label: 'Facility Name' },
    ],
  },
  {
    category: 'Alternate',
    items: [
      { token: 'ALTERNATE_CONTACT', label: 'Alt. Name' },
      { token: 'ALTERNATE_ADDRESS', label: 'Alt. Address' },
      { token: 'ALTERNATE_PHONE_NUMBER', label: 'Alt. Phone' },
      { token: 'ALTERNATE_EMAIL', label: 'Alt. Email' },
    ],
  },
]

// ── Sample data for preview ───────────────────────────────────────────────────

const todayFormatted = new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const SAMPLE_VALUES: Record<string, string> = {
  CUSTOMER_NAME: 'John Smith',
  CUSTOMER_ADDRESS: '123 Oak Street',
  CUSTOMER_PHONE_NUMBER: '(865) 555-0100',
  EMAIL_ADDRESS: 'john.smith@email.com',
  CUSTOMER_USERNAME: 'john.smith@email.com',
  CUSTOMER_ACCESS_CODE: '4829',
  UNIT: 'B-14',
  UNIT_SIZE: '10×15',
  RENT: '$165.00',
  DEPOSIT: '$165.00',
  DATE: todayFormatted,
  ALTERNATE_CONTACT: 'Jane Smith',
  ALTERNATE_ADDRESS: '456 Pine Ave',
  ALTERNATE_PHONE_NUMBER: '(865) 555-0200',
  ALTERNATE_EMAIL: 'jane@email.com',
  BALANCE: '$165.00',
  FACILITY_NAME: '', // filled dynamically from settings
}

// ── Default template ──────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE = `Occupant: [[CUSTOMER_NAME]], [[CUSTOMER_ADDRESS]], [[CUSTOMER_PHONE_NUMBER]], [[EMAIL_ADDRESS]]

Username: [[CUSTOMER_USERNAME]]     Gate Access 5am-10pm Code: [[CUSTOMER_ACCESS_CODE]]#

Unit: [[UNIT]]  Size: [[UNIT_SIZE]]  Monthly price: [[RENT]]  Deposit paid: [[DEPOSIT]]

Rental Agreement Date: [[DATE]]

Alternate Contact
Name: [[ALTERNATE_CONTACT]]
Address: [[ALTERNATE_ADDRESS]]
Phone: [[ALTERNATE_PHONE_NUMBER]]   Email: [[ALTERNATE_EMAIL]]

Late Fees
$20 if Delinquent after 5 Days
NSF Fee: $35
Auction/Sale Fee: $50

Total Amount Currently Due: [[BALANCE]]

[Agreement body goes here — paste the full legal text]

OWNER/MANAGER:                                    OCCUPANT: [[CUSTOMER_NAME]]`

// ── Preview renderer ──────────────────────────────────────────────────────────

/**
 * Splits the template into segments: plain text and [[TOKEN]] spans.
 * Returns an array of React-renderable nodes.
 */
function renderPreview(
  template: string,
  sampleValues: Record<string, string>,
): React.ReactNode[] {
  const parts = template.split(/(\[\[[A-Z_]+\]\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[\[([A-Z_]+)\]\]$/)
    if (match) {
      const token = match[1]
      const value = sampleValues[token] ?? part
      return (
        <span
          key={i}
          style={{
            background: '#FEF3C7',
            color: '#92400E',
            padding: '0 2px',
            borderRadius: 2,
          }}
        >
          {value}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgreementTemplatePage() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [template, setTemplate] = useState('')
  const [savedTemplate, setSavedTemplate] = useState('')
  const [facilityName, setFacilityName] = useState('Tuscany Village Self Storage')

  const isDirty = template !== savedTemplate

  // ── Fetch settings on mount ─────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings')
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load settings')
        }
        const data: SettingsData = json.data
        const tpl = data.agreementTemplate || DEFAULT_TEMPLATE
        setTemplate(tpl)
        setSavedTemplate(tpl)
        if (data.facilityName) setFacilityName(data.facilityName)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings')
        // Still populate with defaults so the editor is usable
        setTemplate(DEFAULT_TEMPLATE)
        setSavedTemplate(DEFAULT_TEMPLATE)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Sample values with live facility name ───────────────────────────────────

  const sampleValues = useMemo<Record<string, string>>(
    () => ({ ...SAMPLE_VALUES, FACILITY_NAME: facilityName }),
    [facilityName],
  )

  // ── Live preview ────────────────────────────────────────────────────────────

  const previewNodes = useMemo(
    () => renderPreview(template, sampleValues),
    [template, sampleValues],
  )

  // ── Insert placeholder at cursor ────────────────────────────────────────────

  const insertPlaceholder = useCallback(
    (token: string) => {
      const el = textareaRef.current
      if (!el) return
      const start = el.selectionStart
      const end = el.selectionEnd
      const newVal =
        template.slice(0, start) + `[[${token}]]` + template.slice(end)
      setTemplate(newVal)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(
          start + token.length + 4,
          start + token.length + 4,
        )
      })
    },
    [template],
  )

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementTemplate: template }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to save')
      }
      setSavedTemplate(template)
      setSavedOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agreement')
    } finally {
      setSaving(false)
    }
  }

  // ── Preview scroll-to-top helper ────────────────────────────────────────────

  function handlePreviewClick() {
    const previewEl = document.getElementById('agreement-preview-card')
    if (previewEl) {
      previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 300,
        }}
      >
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
          flexWrap: 'wrap',
        }}
      >
        {/* Breadcrumb */}
        <Button
          component={Link}
          href="/admin/settings"
          startIcon={<ArrowBackIcon />}
          sx={{
            color: 'text.secondary',
            textTransform: 'none',
            fontWeight: 500,
            '&:hover': { color: '#B8914A', bgcolor: 'transparent' },
            px: 0,
            minWidth: 0,
          }}
        >
          Setup
        </Button>

        {/* Title */}
        <Typography
          variant="h5"
          sx={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 700,
            color: '#1C0F06',
            flex: 1,
          }}
        >
          Storage Agreement
        </Typography>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={handlePreviewClick}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              borderColor: '#EDE5D8',
              color: '#1C0F06',
              '&:hover': { borderColor: '#B8914A', color: '#B8914A' },
            }}
          >
            Preview
          </Button>
          <Button
            variant="contained"
            startIcon={
              saving ? (
                <CircularProgress size={16} sx={{ color: 'white' }} />
              ) : (
                <SaveIcon />
              )
            }
            onClick={handleSave}
            disabled={saving || !isDirty}
            sx={{
              bgcolor: '#B8914A',
              '&:hover': { bgcolor: '#9A7A3E' },
              '&.Mui-disabled': { bgcolor: '#D4B87A', color: 'white' },
              textTransform: 'none',
              fontWeight: 600,
              px: 2.5,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      </Box>

      {/* ── Error alert ────────────────────────────────────────────────────── */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mb: 2.5, borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      {/* ── Two-panel layout ────────────────────────────────────────────────── */}
      <Grid container spacing={3} alignItems="flex-start">
        {/* ── Left panel: Editor ─────────────────────────────────────────── */}
        <Grid item xs={12} md={7}>
          {/* Sticky placeholder toolbar */}
          <Box
            sx={{
              position: 'sticky',
              top: 16,
              zIndex: 10,
              bgcolor: '#FAF7F2',
              border: '1px solid #EDE5D8',
              borderRadius: 2,
              p: 2,
              mb: 2,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                display: 'block',
                mb: 1.5,
              }}
            >
              Insert Placeholder
            </Typography>

            {PLACEHOLDER_GROUPS.map((group) => (
              <Box key={group.category} sx={{ mb: 1.5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#B8914A',
                    fontWeight: 600,
                    display: 'block',
                    mb: 0.75,
                    letterSpacing: '0.04em',
                  }}
                >
                  {group.category}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {group.items.map(({ token, label }) => (
                    <Chip
                      key={token}
                      label={label}
                      size="small"
                      onClick={() => insertPlaceholder(token)}
                      title={`[[${token}]]`}
                      sx={{
                        fontFamily: '"DM Sans", sans-serif',
                        fontSize: '0.72rem',
                        height: 24,
                        bgcolor: 'white',
                        border: '1px solid #EDE5D8',
                        color: '#1C0F06',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: '#B8914A',
                          color: 'white',
                          borderColor: '#B8914A',
                        },
                        '& .MuiChip-label': { px: 1 },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Textarea editor */}
          <textarea
            ref={textareaRef}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 600,
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 1.6,
              padding: 16,
              border: '1px solid #EDE5D8',
              borderRadius: 4,
              background: 'white',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
              color: '#1C0F06',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#B8914A'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#EDE5D8'
            }}
          />
        </Grid>

        {/* ── Right panel: Live preview ───────────────────────────────────── */}
        <Grid item xs={12} md={5}>
          <Box sx={{ position: 'sticky', top: 24 }}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
                mb: 1,
                fontWeight: 500,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontSize: '0.7rem',
              }}
            >
              Preview
            </Typography>

            <Box
              id="agreement-preview-card"
              sx={{
                border: '1px solid #EDE5D8',
                borderRadius: 2,
                bgcolor: 'white',
                p: 3,
                overflowY: 'auto',
                maxHeight: '80vh',
              }}
            >
              <Typography
                component="div"
                sx={{
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: '0.875rem',
                  lineHeight: 1.7,
                  color: '#1C0F06',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {previewNodes}
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* ── Success snackbar ────────────────────────────────────────────────── */}
      <Snackbar
        open={savedOpen}
        autoHideDuration={3000}
        onClose={() => setSavedOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSavedOpen(false)}
          severity="success"
          variant="filled"
          sx={{
            bgcolor: '#B8914A',
            color: 'white',
            fontWeight: 500,
            '& .MuiAlert-icon': { color: 'white' },
          }}
        >
          Agreement saved successfully
        </Alert>
      </Snackbar>
    </Box>
  )
}
