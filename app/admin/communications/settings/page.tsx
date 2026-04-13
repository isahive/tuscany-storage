'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
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
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import EmailIcon from '@mui/icons-material/Email'
import SmsIcon from '@mui/icons-material/Sms'
import PrintIcon from '@mui/icons-material/Print'
import NotificationsIcon from '@mui/icons-material/Notifications'

// ── Types ────────────────────────────────────────────────────────────────────

interface CommunicationSettings {
  // Email
  notificationEmail: string
  replyToEmail: string
  fromDisplayName: string
  reminderPeriodDays: number

  // Text
  textOnCreditWithoutPayment: boolean
  textOnOnlineRental: boolean

  // Print
  printInvoiceReminders: boolean
  printFormat: 'letter' | 'postcard'
  invoiceReceiptHeader: string

  // Admin Notifications
  adminNotifications: {
    creditWithoutPayment: boolean
    dailyFailedNotificationSummary: boolean
    dailyLockOut: boolean
    dailySignedStorageAgreements: boolean
    failedRecurringBilling: boolean
    lockOutRemoval: boolean
    moveOutRequest: boolean
    newRental: boolean
    newReservation: boolean
    newWaitingList: boolean
    successfulPayment: boolean
  }
}

const DEFAULT_SETTINGS: CommunicationSettings = {
  notificationEmail: '',
  replyToEmail: '',
  fromDisplayName: '',
  reminderPeriodDays: 3,
  textOnCreditWithoutPayment: false,
  textOnOnlineRental: false,
  printInvoiceReminders: false,
  printFormat: 'letter',
  invoiceReceiptHeader: '',
  adminNotifications: {
    creditWithoutPayment: false,
    dailyFailedNotificationSummary: true,
    dailyLockOut: true,
    dailySignedStorageAgreements: false,
    failedRecurringBilling: true,
    lockOutRemoval: false,
    moveOutRequest: true,
    newRental: true,
    newReservation: true,
    newWaitingList: false,
    successfulPayment: false,
  },
}

const ADMIN_NOTIFICATION_LABELS: Record<
  keyof CommunicationSettings['adminNotifications'],
  string
> = {
  creditWithoutPayment: 'Credit Without Payment',
  dailyFailedNotificationSummary: 'Daily Failed Notification Summary',
  dailyLockOut: 'Daily Lock Out',
  dailySignedStorageAgreements: 'Daily Signed Storage Agreements',
  failedRecurringBilling: 'Failed Recurring Billing',
  lockOutRemoval: 'Lock Out Removal',
  moveOutRequest: 'Move Out Request',
  newRental: 'New Rental',
  newReservation: 'New Reservation',
  newWaitingList: 'New Waiting List',
  successfulPayment: 'Successful Payment',
}

// ── Shared styles ────────────────────────────────────────────────────────────

const sectionHeaderSx = {
  bgcolor: '#1C0F06',
  color: 'white',
  px: 2.5,
  py: 1.5,
  borderRadius: '8px 8px 0 0',
  fontWeight: 600,
  fontSize: '0.875rem',
  display: 'flex',
  alignItems: 'center',
  gap: 1,
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: '#EDE5D8' },
    '&:hover fieldset': { borderColor: '#B8914A' },
    '&.Mui-focused fieldset': { borderColor: '#B8914A' },
  },
}

const checkboxSx = {
  color: '#B8914A',
  '&.Mui-checked': { color: '#B8914A' },
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CommunicationSettingsPage() {
  const [settings, setSettings] = useState<CommunicationSettings>(DEFAULT_SETTINGS)
  const [savedJson, setSavedJson] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentJson = JSON.stringify(settings)
  const isDirty = currentJson !== savedJson

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/admin/communication-settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const merged = { ...DEFAULT_SETTINGS, ...json.data }
          merged.adminNotifications = {
            ...DEFAULT_SETTINGS.adminNotifications,
            ...(json.data.adminNotifications ?? {}),
          }
          setSettings(merged)
          setSavedJson(JSON.stringify(merged))
        } else {
          setSavedJson(JSON.stringify(DEFAULT_SETTINGS))
        }
      })
      .catch(() => {
        setError('Failed to load communication settings')
        setSavedJson(JSON.stringify(DEFAULT_SETTINGS))
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/communication-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Save failed')
      setSavedJson(JSON.stringify(settings))
      setSuccessOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [settings])

  // ── Field helpers ────────────────────────────────────────────────────────

  function updateField<K extends keyof CommunicationSettings>(
    key: K,
    value: CommunicationSettings[K]
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function updateNotification(
    key: keyof CommunicationSettings['adminNotifications'],
    value: boolean
  ) {
    setSettings((prev) => ({
      ...prev,
      adminNotifications: { ...prev.adminNotifications, [key]: value },
    }))
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
          flexWrap: 'wrap',
        }}
      >
        <Button
          component={Link}
          href="/admin/communications"
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
          Communications
        </Button>
        <Typography
          variant="h5"
          sx={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 700,
            color: '#1C0F06',
            flex: 1,
          }}
        >
          Communication Settings
        </Typography>
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
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mb: 2.5, borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* ── Email Settings ──────────────────────────────────────────────── */}
        <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
          <Box sx={sectionHeaderSx}>
            <EmailIcon sx={{ fontSize: 18 }} />
            Email Settings
          </Box>
          <CardContent sx={{ p: 2.5 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2.5,
              }}
            >
              <TextField
                label="Notification Email"
                fullWidth
                size="small"
                value={settings.notificationEmail}
                onChange={(e) => updateField('notificationEmail', e.target.value)}
                placeholder="admin@example.com"
                helperText="Where admin receives notification emails"
                sx={inputSx}
              />
              <TextField
                label="Reply-to Email"
                fullWidth
                size="small"
                value={settings.replyToEmail}
                onChange={(e) => updateField('replyToEmail', e.target.value)}
                placeholder="noreply@example.com"
                helperText="Reply-to address on outbound emails"
                sx={inputSx}
              />
              <TextField
                label="From Display Name"
                fullWidth
                size="small"
                value={settings.fromDisplayName}
                onChange={(e) => updateField('fromDisplayName', e.target.value)}
                placeholder="Tuscany Village Storage"
                helperText="Name shown in the From field"
                sx={inputSx}
              />
              <TextField
                label="Reminder Period (days before due date)"
                fullWidth
                size="small"
                type="number"
                value={settings.reminderPeriodDays}
                onChange={(e) =>
                  updateField(
                    'reminderPeriodDays',
                    Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0))
                  )
                }
                inputProps={{ min: 0, max: 20 }}
                helperText="Send payment reminder this many days before due date (0-20)"
                sx={inputSx}
              />
            </Box>
          </CardContent>
        </Card>

        {/* ── Text Message Settings ───────────────────────────────────────── */}
        <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
          <Box sx={sectionHeaderSx}>
            <SmsIcon sx={{ fontSize: 18 }} />
            Text Message Settings
          </Box>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.textOnCreditWithoutPayment}
                    onChange={(e) =>
                      updateField('textOnCreditWithoutPayment', e.target.checked)
                    }
                    sx={checkboxSx}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Text owner when there is a credit without payment
                  </Typography>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.textOnOnlineRental}
                    onChange={(e) =>
                      updateField('textOnOnlineRental', e.target.checked)
                    }
                    sx={checkboxSx}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Text owner when a tenant rents online
                  </Typography>
                }
              />
            </Box>
          </CardContent>
        </Card>

        {/* ── Print Settings ──────────────────────────────────────────────── */}
        <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
          <Box sx={sectionHeaderSx}>
            <PrintIcon sx={{ fontSize: 18 }} />
            Print Settings
          </Box>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.printInvoiceReminders}
                    onChange={(e) =>
                      updateField('printInvoiceReminders', e.target.checked)
                    }
                    sx={checkboxSx}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Print Invoice Reminders
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Automatically create print queue items when billing runs
                    </Typography>
                  </Box>
                }
              />

              <FormControl>
                <FormLabel
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    color: 'text.primary',
                    mb: 0.5,
                    '&.Mui-focused': { color: 'text.primary' },
                  }}
                >
                  Print Format
                </FormLabel>
                <RadioGroup
                  row
                  value={settings.printFormat}
                  onChange={(e) =>
                    updateField('printFormat', e.target.value as 'letter' | 'postcard')
                  }
                >
                  <FormControlLabel
                    value="letter"
                    control={
                      <Radio
                        sx={{
                          color: '#B8914A',
                          '&.Mui-checked': { color: '#B8914A' },
                        }}
                      />
                    }
                    label={<Typography variant="body2">Letter</Typography>}
                  />
                  <FormControlLabel
                    value="postcard"
                    control={
                      <Radio
                        sx={{
                          color: '#B8914A',
                          '&.Mui-checked': { color: '#B8914A' },
                        }}
                      />
                    }
                    label={<Typography variant="body2">Postcard</Typography>}
                  />
                </RadioGroup>
              </FormControl>

              <TextField
                label="Invoice & Receipt Header"
                fullWidth
                size="small"
                value={settings.invoiceReceiptHeader}
                onChange={(e) =>
                  updateField(
                    'invoiceReceiptHeader',
                    e.target.value.slice(0, 100)
                  )
                }
                placeholder="Sales Tax ID: 123456789"
                helperText={`${settings.invoiceReceiptHeader.length}/100 characters`}
                inputProps={{ maxLength: 100 }}
                sx={inputSx}
              />
            </Box>
          </CardContent>
        </Card>

        {/* ── Admin Notifications ─────────────────────────────────────────── */}
        <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}>
          <Box sx={sectionHeaderSx}>
            <NotificationsIcon sx={{ fontSize: 18 }} />
            Admin Notifications
          </Box>
          <CardContent sx={{ p: 2.5 }}>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mb: 2 }}
            >
              Select which events should trigger an email notification to the admin.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 0.5,
              }}
            >
              {(
                Object.entries(ADMIN_NOTIFICATION_LABELS) as [
                  keyof CommunicationSettings['adminNotifications'],
                  string,
                ][]
              ).map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      checked={settings.adminNotifications[key]}
                      onChange={(e) => updateNotification(key, e.target.checked)}
                      size="small"
                      sx={checkboxSx}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {label}
                    </Typography>
                  }
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Success snackbar */}
      <Snackbar
        open={successOpen}
        autoHideDuration={3000}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSuccessOpen(false)}
          severity="success"
          variant="filled"
          sx={{
            bgcolor: '#B8914A',
            color: 'white',
            fontWeight: 500,
            '& .MuiAlert-icon': { color: 'white' },
          }}
        >
          Communication settings saved
        </Alert>
      </Snackbar>
    </Box>
  )
}
