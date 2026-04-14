'use client'

import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
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
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'

interface Template {
  _id: string
  name: string
  description?: string
  type: 'default' | 'custom'
  rule?: string
  daysPastDue?: number
  channels: {
    email: boolean
    text: boolean
    print: boolean
  }
}

function ChannelIcon({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <CheckCircleIcon sx={{ fontSize: 18, color: '#4CAF50' }} />
  ) : (
    <CancelIcon sx={{ fontSize: 18, color: '#ccc' }} />
  )
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/admin/templates')
      if (!res.ok) throw new Error('Failed to load templates')
      const data = await res.json()
      setTemplates(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      const res = await fetch(`/api/admin/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete template')
      setTemplates((prev) => prev.filter((t) => t._id !== id))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const defaultTemplates = templates.filter((t) => t.type === 'default')
  const customTemplates = templates.filter((t) => t.type === 'custom')

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
                  <TableCell align="center"><ChannelIcon enabled={t.channels?.email} /></TableCell>
                  <TableCell align="center"><ChannelIcon enabled={t.channels?.text} /></TableCell>
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
              <TableCell sx={{ fontWeight: 600, color: '#1C0F06' }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                  No custom templates yet. Click &quot;Create Template&quot; to add one.
                </TableCell>
              </TableRow>
            ) : (
              customTemplates.map((t) => (
                <TableRow
                  key={t._id}
                  hover
                  sx={{ '&:hover': { bgcolor: '#FAF7F2' } }}
                >
                  <TableCell sx={{ fontWeight: 500 }}>{t.name}</TableCell>
                  <TableCell>
                    {t.rule ? (
                      <Chip
                        label={t.rule}
                        size="small"
                        sx={{
                          bgcolor: '#FAF7F2',
                          color: '#B8914A',
                          fontWeight: 600,
                          border: '1px solid #EDE5D8',
                        }}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell align="center">{t.daysPastDue ?? '—'}</TableCell>
                  <TableCell align="center"><ChannelIcon enabled={t.channels?.email} /></TableCell>
                  <TableCell align="center"><ChannelIcon enabled={t.channels?.text} /></TableCell>
                  <TableCell align="center"><ChannelIcon enabled={t.channels?.print} /></TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label="Edit template"
                      onClick={() => router.push(`/admin/communications/templates/${t._id}`)}
                      sx={{ color: '#B8914A' }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Delete template"
                      onClick={() => handleDelete(t._id)}
                      sx={{ color: '#d32f2f', ml: 0.5 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
