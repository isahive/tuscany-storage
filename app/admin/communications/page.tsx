'use client'

import { Box, Card, CardContent, Grid, Typography } from '@mui/material'
import Link from 'next/link'
import PrintIcon from '@mui/icons-material/Print'
import DescriptionIcon from '@mui/icons-material/Description'
import SettingsIcon from '@mui/icons-material/Settings'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import SendIcon from '@mui/icons-material/Send'
import LabelIcon from '@mui/icons-material/Label'
import SmsIcon from '@mui/icons-material/Sms'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'

const CARDS = [
  { title: 'Print Batches', description: 'Create and manage print batches for invoices and notices', icon: <PrintIcon sx={{ color: 'white', fontSize: 28 }} />, href: '/admin/communications/print-batches' },
  { title: 'Templates', description: 'Edit email, text, and letter notification templates', icon: <DescriptionIcon sx={{ color: 'white', fontSize: 28 }} />, href: '/admin/communications/templates' },
  { title: 'Settings', description: 'Configure email, SMS, and print notification settings', icon: <SettingsIcon sx={{ color: 'white', fontSize: 28 }} />, href: '/admin/communications/settings' },
  { title: 'Print/Email Letters', description: 'Send a template to a group of customers', icon: <MailOutlineIcon sx={{ color: 'white', fontSize: 28 }} />, href: '/admin/communications/letters' },
  { title: 'Send Email', description: 'Compose and send a custom email to customers', icon: <SendIcon sx={{ color: 'white', fontSize: 28 }} />, href: '/admin/communications/send-email' },
  { title: 'Mailing Labels', description: 'Generate printable mailing labels for envelopes', icon: <LabelIcon sx={{ color: 'white', fontSize: 28 }} />, href: '/admin/communications/mailing-labels' },
  { title: 'Text Messages', description: 'View SMS history and customer consent status', icon: <SmsIcon sx={{ color: 'white', fontSize: 28 }} />, href: '/admin/communications/text-messages' },
]

export default function CommunicationsPage() {
  return (
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
        Email, Txt &amp; Print
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Manage all tenant communications — email, text messages, and printed documents.
      </Typography>
      <Grid container spacing={3}>
        {CARDS.map((card) => (
          <Grid item xs={12} sm={6} key={card.title}>
            <Card
              component={Link}
              href={card.href}
              tabIndex={0}
              role="link"
              sx={{
                border: '1px solid #EDE5D8',
                boxShadow: 'none',
                borderRadius: 2,
                cursor: 'pointer',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                },
                '&:focus-visible': {
                  outline: '2px solid #B8914A',
                  outlineOffset: 2,
                },
              }}
            >
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  {card.icon}
                </Box>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, color: '#1C0F06', mb: 0.5 }}
                >
                  {card.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', mb: 2 }}
                >
                  {card.description}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <ArrowForwardIosIcon
                    sx={{ fontSize: 14, color: 'text.secondary' }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
