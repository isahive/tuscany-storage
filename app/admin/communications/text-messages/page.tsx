'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import SmsIcon from '@mui/icons-material/Sms'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import { useRouter } from 'next/navigation'

interface TextMessageRow {
  _id: string
  tenantId: { _id: string; firstName: string; lastName: string } | null
  phone: string
  message: string
  sender: string
  status: 'sent' | 'delivered' | 'failed' | 'received'
  createdAt: string
}

interface ConsentTenant {
  id: string
  firstName: string
  lastName: string
  phone: string
  smsOptIn: boolean
}

const STATUS_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  sent:      { bg: '#DBEAFE', color: '#1E40AF', label: 'Sent' },
  delivered: { bg: '#D1FAE5', color: '#065F46', label: 'Delivered' },
  failed:    { bg: '#FEE2E2', color: '#991B1B', label: 'Failed' },
  received:  { bg: '#F3E8FF', color: '#6B21A8', label: 'Received' },
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function TextMessagesPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<TextMessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [monthlyCount, setMonthlyCount] = useState(0)
  const [consentOpen, setConsentOpen] = useState(false)
  const [consentTenants, setConsentTenants] = useState<ConsentTenant[]>([])
  const [consentLoading, setConsentLoading] = useState(false)
  const rowsPerPage = 25

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
      })
      const res = await fetch(`/api/admin/text-messages?${params}`)
      const json = await res.json()
      if (json.success) {
        setMessages(json.data.items)
        setTotal(json.data.total)
        setMonthlyCount(json.data.monthlyCount)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const handleOpenConsent = async () => {
    setConsentOpen(true)
    setConsentLoading(true)
    try {
      const res = await fetch('/api/tenants?limit=500')
      const json = await res.json()
      if (json.success) {
        const items: ConsentTenant[] = (json.data?.items ?? []).map((t: Record<string, unknown>) => ({
          id: t._id as string,
          firstName: t.firstName as string,
          lastName: t.lastName as string,
          phone: t.phone as string,
          smsOptIn: t.smsOptIn as boolean,
        }))
        setConsentTenants(items)
      }
    } catch {
      // ignore
    } finally {
      setConsentLoading(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: '#1C0F06',
            fontFamily: '"Playfair Display", serif',
          }}
        >
          Text Messages
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={handleOpenConsent}
        >
          Customer Consent Status
        </Button>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        View SMS history and delivery status.
      </Typography>

      {/* Two-way texting alert */}
      <Alert
        severity="warning"
        icon={<WarningAmberIcon fontSize="small" />}
        sx={{
          mb: 3,
          bgcolor: '#FFFBEB',
          border: '1px solid #FDE68A',
          '& .MuiAlert-icon': { color: '#D97706' },
        }}
      >
        Two-way texting is currently not enabled. SMS messages are sent automatically by the system.
      </Alert>

      {/* Monthly usage */}
      <Card sx={{ mb: 3, border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <SmsIcon sx={{ color: '#6B5B3E', fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1C0F06', lineHeight: 1.2 }}>
              {monthlyCount} / 800
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              texts sent this month
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              ml: 2,
              height: 8,
              bgcolor: '#EDE5D8',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: `${Math.min(100, (monthlyCount / 800) * 100)}%`,
                height: '100%',
                bgcolor: monthlyCount > 700 ? '#DC2626' : monthlyCount > 500 ? '#F59E0B' : '#059669',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }}
            />
          </Box>
        </Box>
      </Card>

      {/* Messages table */}
      <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SmsIcon sx={{ fontSize: 48, color: '#EDE5D8', mb: 1 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No text messages have been sent yet.
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#1C0F06' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Customer</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Message</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Date/Time</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Sender</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {messages.map((msg) => {
                    const statusStyle = STATUS_CHIP[msg.status] || STATUS_CHIP.sent
                    const tenantName = msg.tenantId
                      ? `${msg.tenantId.firstName} ${msg.tenantId.lastName}`
                      : 'Unknown'
                    const tenantId = msg.tenantId?._id

                    return (
                      <TableRow
                        key={msg._id}
                        sx={{
                          '&:hover': { bgcolor: '#FAF7F2' },
                          '& td': { borderColor: '#EDE5D8' },
                        }}
                      >
                        <TableCell>
                          {tenantId ? (
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 500,
                                color: '#6B5B3E',
                                cursor: 'pointer',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                              onClick={() => router.push(`/admin/tenants/${tenantId}`)}
                            >
                              {tenantName}
                            </Typography>
                          ) : (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              {tenantName}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'text.secondary',
                              maxWidth: 300,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {msg.message}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                            {formatDateTime(msg.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {msg.sender}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusStyle.label}
                            size="small"
                            sx={{
                              bgcolor: statusStyle.bg,
                              color: statusStyle.color,
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              borderRadius: 1,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[25]}
              sx={{ borderTop: '1px solid #EDE5D8' }}
            />
          </>
        )}
      </Card>

      {/* Customer Consent Dialog */}
      <Dialog
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Customer SMS Consent Status
          </Typography>
          <IconButton size="small" onClick={() => setConsentOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {consentLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : consentTenants.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
              No tenants found.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Opted In</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {consentTenants.map((t) => (
                  <TableRow key={t.id} sx={{ '&:hover': { bgcolor: '#FAF7F2' } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t.firstName} {t.lastName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {t.phone}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {t.smsOptIn ? (
                        <CheckCircleIcon sx={{ color: '#059669', fontSize: 20 }} />
                      ) : (
                        <CancelIcon sx={{ color: '#DC2626', fontSize: 20 }} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
