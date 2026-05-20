'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Link as MuiLink,
  Radio,
  RadioGroup,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

type GateAccessState = {
  tenantId: string
  firstName: string
  lastName: string
  status: 'active' | 'delinquent' | 'locked_out' | 'moved_out'
  gateCode: string
  additionalCards: string[]
  gateGroups: string[]
  lockoutAuctionDate: string | null
  auctionDateSource: 'manual' | 'system' | null
  lockoutNote: string
  automaticLockoutEnabled: boolean
  automaticLockoutDays: number
  hasActiveRental: boolean
}

const ALL_GROUPS = ['Managers 24/7', 'Renters']

// Project palette — primary olive matches the rest of /admin.
const BTN = '#8CA87C'
const BTN_HOVER = '#7E9770'

export default function GateAccessPage() {
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [state, setState] = useState<GateAccessState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Form fields
  const [auctionDate, setAuctionDate] = useState('')
  const [note, setNote] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [newCard, setNewCard] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [autoEnabled, setAutoEnabled] = useState(true)
  const [autoDays, setAutoDays] = useState(9)

  useSetAdminPageTitle('Gate Access')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenants/${tenantId}/gate-access`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      const s: GateAccessState = json.data
      setState(s)
      setAccessCode(s.gateCode || '')
      setSelectedGroups(s.gateGroups || [])
      setAutoEnabled(s.automaticLockoutEnabled)
      setAutoDays(s.automaticLockoutDays)
      setAuctionDate(s.lockoutAuctionDate ? s.lockoutAuctionDate.slice(0, 10) : '')
      setNote(s.lockoutNote || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  async function post(payload: Record<string, unknown>, successMsg: string) {
    const res = await fetch(`/api/tenants/${tenantId}/gate-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!json.success) {
      setToast(json.error || 'Action failed')
      return false
    }
    setToast(successMsg)
    await load()
    return true
  }

  async function handleLockOut() {
    await post(
      { action: 'lock_out', auctionDate: auctionDate || undefined, note },
      'Customer locked out. Gate access revoked.',
    )
  }
  async function handleUnlock() {
    await post({ action: 'unlock' }, 'Lock-out cleared.')
  }
  async function handleSaveCode() {
    if (!/^\d{1,10}$/.test(accessCode)) {
      setToast('Access code must be 1–10 digits.')
      return
    }
    await post({ action: 'set_access_code', accessCode }, 'Access code saved.')
  }
  async function handleAddCard() {
    if (!/^[1-9]\d*$/.test(newCard)) {
      setToast('Card numbers must be unique and cannot start with 0.')
      return
    }
    const ok = await post({ action: 'add_card', card: newCard }, 'Card added.')
    if (ok) setNewCard('')
  }
  async function handleRemoveCard(card: string) {
    await post({ action: 'remove_card', card }, 'Card removed.')
  }
  async function handleSaveGroups() {
    await post({ action: 'save_groups', groups: selectedGroups }, 'Gate groups saved.')
  }
  async function handleUpdateLockoutSettings() {
    await post(
      { action: 'set_automatic_lockout', enabled: autoEnabled, days: autoDays },
      'Lockout settings updated.',
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 16 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !state) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Typography color="error" sx={{ mb: 2 }}>{error ?? 'Failed to load'}</Typography>
        <Button onClick={() => router.push(`/admin/tenants/${tenantId}`)}>Back to Customer</Button>
      </Box>
    )
  }

  const fullName = `${state.firstName} ${state.lastName}`
  const isLockedOut = state.status === 'locked_out'

  return (
    <Box>
      {/* Header — admin layout already shows the breadcrumb, so just the title. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Back
        </Button>
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: '#1C0F06', fontFamily: '"Playfair Display", serif', flex: 1 }}
        >
          Gate Access{fullName ? ` — ${fullName}` : ''}
        </Typography>
      </Box>

      {!state.hasActiveRental && (
        <Alert
          severity="warning"
          sx={{
            mb: 3, bgcolor: '#FEEFE4', color: '#7C2D12', fontWeight: 600,
            border: '1px solid #FED7AA', '& .MuiAlert-icon': { color: '#C2410C' },
          }}
          icon={false}
        >
          This customer does not have any active rentals.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* LEFT: Lock Out + Automatic Lockout */}
        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 3 }}>
            <Box sx={{ bgcolor: '#F3F4F6', px: 3, py: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{fullName}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Status:&nbsp;
                <Box component="span" sx={{ color: isLockedOut ? '#DC2626' : '#0EA371', fontWeight: 600 }}>
                  {isLockedOut ? 'Locked Out' : 'Not Locked Out'}
                </Box>
              </Typography>
            </Box>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Auction Date</Typography>
                {state?.auctionDateSource === 'system' && (
                  <Chip
                    label="Auto-scheduled"
                    size="small"
                    sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 600, fontSize: '0.65rem', height: 20 }}
                  />
                )}
              </Box>
              <TextField
                type="date"
                size="small"
                fullWidth
                value={auctionDate}
                onChange={(e) => setAuctionDate(e.target.value)}
                sx={{ mb: 2 }}
                InputLabelProps={{ shrink: true }}
              />

              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Note</Typography>
              <TextField
                multiline rows={4} fullWidth size="small"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                sx={{ mb: 2 }}
              />

              {isLockedOut ? (
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleUnlock}
                  sx={{ bgcolor: '#0EA371', '&:hover': { bgcolor: '#0B8B60' }, textTransform: 'none', fontWeight: 600 }}
                >
                  Unlock
                </Button>
              ) : (
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleLockOut}
                  sx={{ bgcolor: BTN, '&:hover': { bgcolor: BTN_HOVER }, textTransform: 'none', fontWeight: 600 }}
                >
                  Lock Out
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Automatic Lockout */}
          <Card>
            <Box sx={{ bgcolor: '#F3F4F6', px: 3, py: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Automatic Lockout</Typography>
            </Box>
            <CardContent>
              <RadioGroup
                value={autoEnabled ? 'enabled' : 'disabled'}
                onChange={(e) => setAutoEnabled(e.target.value === 'enabled')}
              >
                <FormControlLabel
                  value="enabled"
                  control={<Radio size="small" />}
                  label={
                    <Typography variant="body2">
                      <strong>Enabled</strong> – {fullName} will be automatically locked out if a rent line item
                      remains unpaid after {autoDays} days
                    </Typography>
                  }
                />
                <FormControlLabel
                  value="disabled"
                  control={<Radio size="small" />}
                  label={
                    <Typography variant="body2">
                      <strong>Disabled</strong> – {fullName} will never be automatically locked out
                    </Typography>
                  }
                />
              </RadioGroup>

              {autoEnabled && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, ml: 4 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Days unpaid:</Typography>
                  <TextField
                    type="number"
                    size="small"
                    value={autoDays}
                    onChange={(e) => setAutoDays(Math.max(0, parseInt(e.target.value || '0', 10)))}
                    sx={{ width: 90 }}
                    inputProps={{ min: 0, max: 120 }}
                  />
                </Box>
              )}

              <Button
                variant="contained"
                disableElevation
                onClick={handleUpdateLockoutSettings}
                sx={{ mt: 2, bgcolor: BTN, '&:hover': { bgcolor: BTN_HOVER }, textTransform: 'none', fontWeight: 600 }}
              >
                Update Lockout Settings
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* RIGHT: Access Code + Gate Groups */}
        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 3 }}>
            <Box sx={{ bgcolor: '#F3F4F6', px: 3, py: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Access Code</Typography>
            </Box>
            <CardContent>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Access Code</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder=""
                  inputProps={{ inputMode: 'numeric' }}
                />
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleSaveCode}
                  sx={{ bgcolor: BTN, '&:hover': { bgcolor: BTN_HOVER }, textTransform: 'none', fontWeight: 600, px: 3 }}
                >
                  Save
                </Button>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Allows up to 10 digits.
              </Typography>

              <Divider sx={{ my: 2.5 }} />

              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Additional Cards</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={newCard}
                  onChange={(e) => setNewCard(e.target.value.replace(/\D/g, ''))}
                  placeholder=""
                  inputProps={{ inputMode: 'numeric' }}
                />
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleAddCard}
                  sx={{ bgcolor: BTN, '&:hover': { bgcolor: BTN_HOVER }, textTransform: 'none', fontWeight: 600, px: 3 }}
                >
                  Add
                </Button>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                Card numbers must be unique and cannot start with 0.
              </Typography>

              {state.additionalCards.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {state.additionalCards.map((card) => (
                    <Chip
                      key={card}
                      label={card}
                      size="small"
                      onDelete={() => handleRemoveCard(card)}
                      deleteIcon={<DeleteOutlineIcon />}
                      sx={{ bgcolor: '#E0E7EF', fontWeight: 600 }}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Gate Groups */}
          <Card>
            <Box sx={{ bgcolor: '#F3F4F6', px: 3, py: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Gate Groups</Typography>
            </Box>
            <CardContent>
              {ALL_GROUPS.map((group) => (
                <FormControlLabel
                  key={group}
                  control={
                    <Checkbox
                      size="small"
                      checked={selectedGroups.includes(group)}
                      onChange={(e) => {
                        setSelectedGroups((prev) =>
                          e.target.checked ? [...prev, group] : prev.filter((g) => g !== group),
                        )
                      }}
                    />
                  }
                  label={<Typography variant="body2">{group}</Typography>}
                  sx={{ display: 'block', ml: -1 }}
                />
              ))}
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1, mb: 1.5 }}>
                Select groups to allow gate access for this customer. Unit default groups are highlighted.
              </Typography>
              <Button
                variant="contained"
                disableElevation
                onClick={handleSaveGroups}
                sx={{ bgcolor: BTN, '&:hover': { bgcolor: BTN_HOVER }, textTransform: 'none', fontWeight: 600 }}
              >
                Save Groups
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
