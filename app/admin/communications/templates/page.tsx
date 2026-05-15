'use client'

import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material'
import { useRouter } from 'next/navigation'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'

interface Template {
  _id: string
  name: string
  description?: string
  type: 'default' | 'custom'
  rule?: string
  daysPastDue?: number
  emailEnabled?: boolean
  textEnabled?: boolean
  printEnabled?: boolean
}

interface LateLienEvent {
  id: string
  status: 'late' | 'locked_out' | 'pre_lien' | 'lien' | 'auction'
  daysPastDue: number
  notifyEmail: boolean
  notifyText: boolean
  notifyLetter: boolean
  notificationTemplate: string
}

interface CustomTemplateRow {
  key: string
  template: Template
  rule: string
  daysPastDue: number | null
  emailEnabled: boolean
  textEnabled: boolean
  printEnabled: boolean
}

const RULE_LABELS: Record<LateLienEvent['status'], string> = {
  late: 'Late',
  locked_out: 'Locked out',
  pre_lien: 'Pre lien',
  lien: 'Lien',
  auction: 'Auction',
}

function ChannelIcon({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <CheckCircleIcon sx={{ fontSize: 18, color: '#4CAF50' }} />
  ) : (
    <CancelIcon sx={{ fontSize: 18, color: '#FF8A3D' }} />
  )
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [lateLienEvents, setLateLienEvents] = useState<LateLienEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const [templatesRes, settingsRes] = await Promise.all([
        fetch('/api/admin/templates'),
        fetch('/api/settings'),
      ])
      if (!templatesRes.ok) throw new Error('Failed to load templates')
      const templatesJson = await templatesRes.json()
      if (!templatesJson.success) throw new Error(templatesJson.error ?? 'Failed to load templates')
      setTemplates(Array.isArray(templatesJson.data) ? templatesJson.data : [])

      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json()
        const events = settingsJson.success && Array.isArray(settingsJson.data?.lateLienEvents)
          ? settingsJson.data.lateLienEvents
          : []
        setLateLienEvents(events)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const defaultTemplates = templates.filter((t) => t.type === 'default')
  const customTemplates = templates.filter((t) => t.type === 'custom')
  const customTemplateRows = customTemplates.map((template) => {
    const events = lateLienEvents
      .filter((event) => event.notificationTemplate === template.name)
      .sort((a, b) => a.daysPastDue - b.daysPastDue)

    const rows: CustomTemplateRow[] = events.length > 0
      ? events.map((event) => ({
          key: `${template._id}-${event.id}`,
          template,
          rule: RULE_LABELS[event.status],
          daysPastDue: event.daysPastDue,
          emailEnabled: event.notifyEmail,
          textEnabled: event.notifyText,
          printEnabled: event.notifyLetter,
        }))
      : [{
          key: `${template._id}-manual`,
          template,
          rule: 'Manual only',
          daysPastDue: null,
          emailEnabled: false,
          textEnabled: false,
          printEnabled: false,
        }]

    return { template, rows }
  })

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: '#1C0F06',
              fontFamily: '"Playfair Display", serif',
              mb: 0.5,
            }}
          >
            Templates
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Manage email, text, and letter notification templates.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/admin/communications/templates/new')}
          sx={{
            bgcolor: '#B8914A',
            '&:hover': { bgcolor: '#A5653A' },
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Create Template
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Default Templates */}
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 700, color: '#1C0F06', mb: 1.5, mt: 2 }}
      >
        Default Templates
      </Typography>
      <TableContainer
        component={Paper}
        sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2, mb: 4 }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#FAF7F2' }}>
              <TableCell sx={{ fontWeight: 600, color: '#1C0F06' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1C0F06' }} align="center">Email</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1C0F06' }} align="center">Text</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1C0F06' }}>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {defaultTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                  No default templates found.
                </TableCell>
              </TableRow>
            ) : (
              defaultTemplates.map((t) => (
                <TableRow
                  key={t._id}
                  hover
                  onClick={() => router.push(`/admin/communications/templates/${t._id}`)}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#FAF7F2' } }}
                >
                  <TableCell sx={{ fontWeight: 500 }}>{t.name}</TableCell>
                  <TableCell align="center"><ChannelIcon enabled={!!t.emailEnabled} /></TableCell>
                  <TableCell align="center"><ChannelIcon enabled={!!t.textEnabled} /></TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{t.description || '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Custom Templates */}
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 700, color: '#1C0F06', mb: 1.5 }}
      >
        Custom Templates
      </Typography>
      <TableContainer
        component={Paper}
        sx={{ border: '1px solid #EDE5D8', boxShadow: 'none', borderRadius: 2 }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#FAF7F2' }}>
              <TableCell sx={{ fontWeight: 600, color: '#1C0F06' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1C0F06' }}>Rule</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1C0F06' }} align="center">Days Past Due</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1C0F06' }} align="center">Email</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1C0F06' }} align="center">Text</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1C0F06' }} align="center">Print</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customTemplateRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                  No custom templates yet. Click &quot;Create Template&quot; to add one.
                </TableCell>
              </TableRow>
            ) : (
              customTemplateRows.flatMap(({ template, rows }) =>
                rows.map((row, index) => (
                  <TableRow
                    key={row.key}
                    hover
                    sx={{ '&:hover': { bgcolor: '#FAF7F2' } }}
                  >
                    {index === 0 && (
                      <TableCell rowSpan={rows.length} sx={{ fontWeight: 500, verticalAlign: 'middle' }}>
                        {template.name}
                      </TableCell>
                    )}
                    <TableCell>
                      {row.rule === 'Manual only' ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Manual only</Typography>
                      ) : (
                        <Chip
                          label={row.rule}
                          size="small"
                          onClick={() => router.push(`/admin/communications/templates/${template._id}`)}
                          sx={{
                            bgcolor: '#FAF7F2',
                            color: '#B8914A',
                            fontWeight: 600,
                            border: '1px solid #EDE5D8',
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: '#F1EEE8',
                              borderColor: '#D8C8A8',
                            },
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">{row.daysPastDue ?? '—'}</TableCell>
                    <TableCell align="center"><ChannelIcon enabled={row.emailEnabled} /></TableCell>
                    <TableCell align="center"><ChannelIcon enabled={row.textEnabled} /></TableCell>
                    <TableCell align="center"><ChannelIcon enabled={row.printEnabled} /></TableCell>
                  </TableRow>
                )),
              )
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
