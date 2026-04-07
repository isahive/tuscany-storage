'use client'

import { useState, type SyntheticEvent } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  InputAdornment,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import BusinessIcon from '@mui/icons-material/Business'
import NotificationsIcon from '@mui/icons-material/Notifications'
import GavelIcon from '@mui/icons-material/Gavel'
import SecurityIcon from '@mui/icons-material/Security'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { formatMoney } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface FacilityInfo {
  name: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  officeHours: string
}

type NotificationType =
  | 'payment_reminder'
  | 'payment_confirmation'
  | 'payment_failed'
  | 'late_notice'
  | 'lockout_notice'
  | 'gate_code_changed'
  | 'move_in_confirmation'
  | 'move_out_confirmation'
  | 'rate_change_notice'
  | 'waiting_list_available'

interface NotificationTemplate {
  subject: string
  body: string
}

interface DelinquencySettings {
  gracePeriodDays: number
  lateFeeAmountCents: number
  lockoutDay: number
  preLienDay: number
  lienDay: number
}

interface GateAccessSettings {
  gateHoursOpen: string
  gateHoursClose: string
  codeLength: number
  maxFailedAttempts: number
}

// ── Notification metadata ────────────────────────────────────────────────────

const NOTIFICATION_TYPES: { key: NotificationType; label: string }[] = [
  { key: 'payment_reminder', label: 'Payment Reminder' },
  { key: 'payment_confirmation', label: 'Payment Confirmation' },
  { key: 'payment_failed', label: 'Payment Failed' },
  { key: 'late_notice', label: 'Late Notice' },
  { key: 'lockout_notice', label: 'Lockout Notice' },
  { key: 'gate_code_changed', label: 'Gate Code Changed' },
  { key: 'move_in_confirmation', label: 'Move-In Confirmation' },
  { key: 'move_out_confirmation', label: 'Move-Out Confirmation' },
  { key: 'rate_change_notice', label: 'Rate Change Notice' },
  { key: 'waiting_list_available', label: 'Waiting List Available' },
]

// ── Mock defaults ────────────────────────────────────────────────────────────

const DEFAULT_FACILITY: FacilityInfo = {
  name: 'Tuscany Village Self Storage',
  address: '8500 Tuscany Way',
  city: 'Austin',
  state: 'TX',
  zip: '78759',
  phone: '(512) 555-0180',
  email: 'office@tuscanyvillagestorage.com',
  officeHours: 'Mon–Fri 9:00 AM – 6:00 PM, Sat 9:00 AM – 4:00 PM',
}

const DEFAULT_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  payment_reminder: {
    subject: 'Payment Reminder – Tuscany Village Self Storage',
    body: 'Hello {{tenant_name}},\n\nThis is a friendly reminder that your payment of {{amount}} for unit {{unit_number}} is due on {{due_date}}.\n\nPlease log in to your tenant portal to make a payment.\n\nThank you,\nTuscany Village Self Storage',
  },
  payment_confirmation: {
    subject: 'Payment Received – Tuscany Village Self Storage',
    body: 'Hello {{tenant_name}},\n\nWe have received your payment of {{amount}} for unit {{unit_number}}.\n\nTransaction ID: {{transaction_id}}\nDate: {{payment_date}}\n\nThank you for your prompt payment.\n\nTuscany Village Self Storage',
  },
  payment_failed: {
    subject: 'Payment Failed – Tuscany Village Self Storage',
    body: 'Hello {{tenant_name}},\n\nYour payment of {{amount}} for unit {{unit_number}} could not be processed. Please update your payment method and try again.\n\nIf you have questions, contact our office at {{facility_phone}}.\n\nTuscany Village Self Storage',
  },
  late_notice: {
    subject: 'Late Payment Notice – Tuscany Village Self Storage',
    body: 'Hello {{tenant_name}},\n\nYour payment for unit {{unit_number}} is now {{days_past_due}} days past due. Your current balance is {{balance}}.\n\nA late fee of {{late_fee}} has been applied. Please make a payment as soon as possible to avoid further action.\n\nTuscany Village Self Storage',
  },
  lockout_notice: {
    subject: 'Unit Access Restricted – Tuscany Village Self Storage',
    body: 'Hello {{tenant_name}},\n\nDue to non-payment, access to your unit {{unit_number}} has been restricted. Your current balance is {{balance}}.\n\nPlease contact our office or make a payment through the tenant portal to restore access.\n\nTuscany Village Self Storage',
  },
  gate_code_changed: {
    subject: 'Gate Code Updated – Tuscany Village Self Storage',
    body: 'Hello {{tenant_name}},\n\nYour gate access code has been updated. Your new code is {{gate_code}}.\n\nPlease keep this code secure and do not share it with others.\n\nTuscany Village Self Storage',
  },
  move_in_confirmation: {
    subject: 'Welcome to Tuscany Village Self Storage',
    body: 'Hello {{tenant_name}},\n\nWelcome! Your move-in for unit {{unit_number}} is confirmed.\n\nUnit: {{unit_number}} ({{unit_size}})\nMonthly Rate: {{monthly_rate}}\nMove-In Date: {{move_in_date}}\nGate Code: {{gate_code}}\n\nPlease visit the office to pick up your keys. We look forward to serving you.\n\nTuscany Village Self Storage',
  },
  move_out_confirmation: {
    subject: 'Move-Out Confirmation – Tuscany Village Self Storage',
    body: 'Hello {{tenant_name}},\n\nYour move-out from unit {{unit_number}} has been processed.\n\nMove-Out Date: {{move_out_date}}\nFinal Balance: {{final_balance}}\n\nThank you for choosing Tuscany Village Self Storage.\n\nTuscany Village Self Storage',
  },
  rate_change_notice: {
    subject: 'Rate Adjustment Notice – Tuscany Village Self Storage',
    body: 'Hello {{tenant_name}},\n\nThis notice is to inform you that the monthly rate for your unit {{unit_number}} will change from {{old_rate}} to {{new_rate}}, effective {{effective_date}}.\n\nIf you have questions, please contact our office.\n\nTuscany Village Self Storage',
  },
  waiting_list_available: {
    subject: 'Unit Available – Tuscany Village Self Storage',
    body: 'Hello {{tenant_name}},\n\nA {{unit_size}} unit is now available matching your waiting list request.\n\nUnit: {{unit_number}}\nMonthly Rate: {{monthly_rate}}\n\nPlease contact us within 48 hours to reserve this unit. After that, it will be offered to the next person on the list.\n\nTuscany Village Self Storage',
  },
}

const DEFAULT_DELINQUENCY: DelinquencySettings = {
  gracePeriodDays: 5,
  lateFeeAmountCents: 2500,
  lockoutDay: 15,
  preLienDay: 30,
  lienDay: 60,
}

const DEFAULT_GATE_ACCESS: GateAccessSettings = {
  gateHoursOpen: '06:00',
  gateHoursClose: '22:00',
  codeLength: 6,
  maxFailedAttempts: 5,
}

// ── Tab panel helper ─────────────────────────────────────────────────────────

function TabPanel({
  children,
  value,
  index,
}: {
  children: React.ReactNode
  value: number
  index: number
}) {
  if (value !== index) return null
  return (
    <Box role="tabpanel" sx={{ pt: 3 }}>
      {children}
    </Box>
  )
}

// ── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  children,
  onSave,
  saving,
}: {
  children: React.ReactNode
  onSave: () => void
  saving: boolean
}) {
  return (
    <Card
      variant="outlined"
      sx={{ border: '1px solid #EDE5D8', borderRadius: 2 }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {children}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={onSave}
            disabled={saving}
            sx={{
              bgcolor: '#B8914A',
              '&:hover': { bgcolor: '#9A7A3E' },
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

// ── Facility Info Tab ────────────────────────────────────────────────────────

function FacilityInfoTab({
  data,
  onChange,
  onSave,
  saving,
}: {
  data: FacilityInfo
  onChange: (field: keyof FacilityInfo, value: string) => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <SectionCard onSave={onSave} saving={saving}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#1C0F06' }}>
        Facility Information
      </Typography>
      <Grid container spacing={2.5}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Facility Name"
            value={data.name}
            onChange={(e) => onChange('name', e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Street Address"
            value={data.address}
            onChange={(e) => onChange('address', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={5}>
          <TextField
            fullWidth
            label="City"
            value={data.city}
            onChange={(e) => onChange('city', e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            fullWidth
            label="State"
            value={data.state}
            onChange={(e) => onChange('state', e.target.value)}
            inputProps={{ maxLength: 2 }}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField
            fullWidth
            label="ZIP Code"
            value={data.zip}
            onChange={(e) => onChange('zip', e.target.value)}
            inputProps={{ maxLength: 10 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Phone"
            value={data.phone}
            onChange={(e) => onChange('phone', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={data.email}
            onChange={(e) => onChange('email', e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Office Hours"
            value={data.officeHours}
            onChange={(e) => onChange('officeHours', e.target.value)}
            helperText="Displayed on the public website and in notification footers"
          />
        </Grid>
      </Grid>
    </SectionCard>
  )
}

// ── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab({
  templates,
  onChange,
  onSave,
  saving,
}: {
  templates: Record<NotificationType, NotificationTemplate>
  onChange: (
    type: NotificationType,
    field: keyof NotificationTemplate,
    value: string,
  ) => void
  onSave: () => void
  saving: boolean
}) {
  const [expanded, setExpanded] = useState<NotificationType | false>(false)

  const handleAccordionChange =
    (panel: NotificationType) => (_: SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false)
    }

  return (
    <SectionCard onSave={onSave} saving={saving}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, color: '#1C0F06' }}>
        Notification Templates
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        Customize the subject line and body for each email and SMS notification.
        Use {'{{variable}}'} placeholders for dynamic content.
      </Typography>
      {NOTIFICATION_TYPES.map(({ key, label }) => (
        <Accordion
          key={key}
          expanded={expanded === key}
          onChange={handleAccordionChange(key)}
          disableGutters
          variant="outlined"
          sx={{
            border: '1px solid #EDE5D8',
            '&:not(:last-of-type)': { mb: 1 },
            '&:before': { display: 'none' },
            borderRadius: '8px !important',
            overflow: 'hidden',
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              '& .MuiAccordionSummary-content': { my: 1.5 },
              bgcolor: expanded === key ? '#FAF7F2' : 'transparent',
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {label}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {key}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
            <Divider sx={{ mb: 2, borderColor: '#EDE5D8' }} />
            <TextField
              fullWidth
              label="Subject"
              value={templates[key].subject}
              onChange={(e) => onChange(key, 'subject', e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Body"
              value={templates[key].body}
              onChange={(e) => onChange(key, 'body', e.target.value)}
              multiline
              minRows={6}
              maxRows={16}
              inputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
            />
          </AccordionDetails>
        </Accordion>
      ))}
    </SectionCard>
  )
}

// ── Delinquency Tab ──────────────────────────────────────────────────────────

function DelinquencyTab({
  data,
  onChange,
  onSave,
  saving,
}: {
  data: DelinquencySettings
  onChange: (field: keyof DelinquencySettings, value: number) => void
  onSave: () => void
  saving: boolean
}) {
  const lateFeeDisplay = (data.lateFeeAmountCents / 100).toFixed(2)

  const handleLateFeeChange = (value: string) => {
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && parsed >= 0) {
      onChange('lateFeeAmountCents', Math.round(parsed * 100))
    } else if (value === '' || value === '0') {
      onChange('lateFeeAmountCents', 0)
    }
  }

  const handleIntChange = (field: keyof DelinquencySettings) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const parsed = parseInt(e.target.value, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(field, parsed)
    } else if (e.target.value === '') {
      onChange(field, 0)
    }
  }

  return (
    <SectionCard onSave={onSave} saving={saving}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, color: '#1C0F06' }}>
        Delinquency Settings
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        Configure the timeline and fees for delinquent accounts. Days are counted from
        the payment due date.
      </Typography>
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Grace Period"
            type="number"
            value={data.gracePeriodDays}
            onChange={handleIntChange('gracePeriodDays')}
            InputProps={{
              endAdornment: <InputAdornment position="end">days</InputAdornment>,
            }}
            helperText="Days after due date before a late fee is applied"
            inputProps={{ min: 0, max: 30 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Late Fee Amount"
            type="number"
            value={lateFeeDisplay}
            onChange={(e) => handleLateFeeChange(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            helperText={`Stored as ${formatMoney(data.lateFeeAmountCents)}`}
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Grid>
        <Grid item xs={12}>
          <Divider sx={{ borderColor: '#EDE5D8' }} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Lockout Day"
            type="number"
            value={data.lockoutDay}
            onChange={handleIntChange('lockoutDay')}
            InputProps={{
              endAdornment: <InputAdornment position="end">days</InputAdornment>,
            }}
            helperText="Day unit access is restricted"
            inputProps={{ min: 1, max: 90 }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Pre-Lien Day"
            type="number"
            value={data.preLienDay}
            onChange={handleIntChange('preLienDay')}
            InputProps={{
              endAdornment: <InputAdornment position="end">days</InputAdornment>,
            }}
            helperText="Day pre-lien notice is sent"
            inputProps={{ min: 1, max: 180 }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Lien Day"
            type="number"
            value={data.lienDay}
            onChange={handleIntChange('lienDay')}
            InputProps={{
              endAdornment: <InputAdornment position="end">days</InputAdornment>,
            }}
            helperText="Day lien is filed on the unit"
            inputProps={{ min: 1, max: 365 }}
          />
        </Grid>
      </Grid>
    </SectionCard>
  )
}

// ── Gate Access Tab ──────────────────────────────────────────────────────────

function GateAccessTab({
  data,
  onChange,
  onSave,
  saving,
}: {
  data: GateAccessSettings
  onChange: (field: keyof GateAccessSettings, value: string | number) => void
  onSave: () => void
  saving: boolean
}) {
  const handleIntChange = (field: 'codeLength' | 'maxFailedAttempts') => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const parsed = parseInt(e.target.value, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(field, parsed)
    } else if (e.target.value === '') {
      onChange(field, 0)
    }
  }

  return (
    <SectionCard onSave={onSave} saving={saving}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, color: '#1C0F06' }}>
        Gate Access Settings
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        Configure the facility gate hours and access code parameters.
      </Typography>
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Gate Opens"
            type="time"
            value={data.gateHoursOpen}
            onChange={(e) => onChange('gateHoursOpen', e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="Time the gate unlocks each day"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Gate Closes"
            type="time"
            value={data.gateHoursClose}
            onChange={(e) => onChange('gateHoursClose', e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="Time the gate locks each night"
          />
        </Grid>
        <Grid item xs={12}>
          <Divider sx={{ borderColor: '#EDE5D8' }} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Access Code Length"
            type="number"
            value={data.codeLength}
            onChange={handleIntChange('codeLength')}
            InputProps={{
              endAdornment: <InputAdornment position="end">digits</InputAdornment>,
            }}
            helperText="Number of digits in tenant gate codes"
            inputProps={{ min: 4, max: 8 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Max Failed Attempts"
            type="number"
            value={data.maxFailedAttempts}
            onChange={handleIntChange('maxFailedAttempts')}
            InputProps={{
              endAdornment: <InputAdornment position="end">attempts</InputAdornment>,
            }}
            helperText="Number of wrong codes before temporary lockout"
            inputProps={{ min: 1, max: 20 }}
          />
        </Grid>
      </Grid>
    </SectionCard>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

const TAB_ICONS = [
  <BusinessIcon key="facility" fontSize="small" />,
  <NotificationsIcon key="notifications" fontSize="small" />,
  <GavelIcon key="delinquency" fontSize="small" />,
  <SecurityIcon key="gate" fontSize="small" />,
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  // ── State ──────────────────────────────────────────────────────────────────

  const [facility, setFacility] = useState<FacilityInfo>(DEFAULT_FACILITY)
  const [templates, setTemplates] = useState<
    Record<NotificationType, NotificationTemplate>
  >(DEFAULT_TEMPLATES)
  const [delinquency, setDelinquency] =
    useState<DelinquencySettings>(DEFAULT_DELINQUENCY)
  const [gateAccess, setGateAccess] =
    useState<GateAccessSettings>(DEFAULT_GATE_ACCESS)

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleTabChange = (_: SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  const simulateSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSnackbarOpen(true)
    }, 600)
  }

  const updateFacility = (field: keyof FacilityInfo, value: string) => {
    setFacility((prev) => ({ ...prev, [field]: value }))
  }

  const updateTemplate = (
    type: NotificationType,
    field: keyof NotificationTemplate,
    value: string,
  ) => {
    setTemplates((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
  }

  const updateDelinquency = (
    field: keyof DelinquencySettings,
    value: number,
  ) => {
    setDelinquency((prev) => ({ ...prev, [field]: value }))
  }

  const updateGateAccess = (
    field: keyof GateAccessSettings,
    value: string | number,
  ) => {
    setGateAccess((prev) => ({ ...prev, [field]: value }))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          color: '#1C0F06',
          fontFamily: '"Playfair Display", serif',
          mb: 3,
        }}
      >
        Settings
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: '#EDE5D8' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              minHeight: 48,
              gap: 0.75,
            },
            '& .Mui-selected': {
              color: '#B8914A !important',
              fontWeight: 600,
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#B8914A',
            },
          }}
        >
          <Tab icon={TAB_ICONS[0]} iconPosition="start" label="Facility Info" />
          <Tab icon={TAB_ICONS[1]} iconPosition="start" label="Notifications" />
          <Tab icon={TAB_ICONS[2]} iconPosition="start" label="Delinquency" />
          <Tab icon={TAB_ICONS[3]} iconPosition="start" label="Gate Access" />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        <FacilityInfoTab
          data={facility}
          onChange={updateFacility}
          onSave={simulateSave}
          saving={saving}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <NotificationsTab
          templates={templates}
          onChange={updateTemplate}
          onSave={simulateSave}
          saving={saving}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <DelinquencyTab
          data={delinquency}
          onChange={updateDelinquency}
          onSave={simulateSave}
          saving={saving}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <GateAccessTab
          data={gateAccess}
          onChange={updateGateAccess}
          onSave={simulateSave}
          saving={saving}
        />
      </TabPanel>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          variant="filled"
          sx={{
            bgcolor: '#B8914A',
            color: 'white',
            fontWeight: 500,
          }}
        >
          Settings saved successfully
        </Alert>
      </Snackbar>
    </Box>
  )
}
