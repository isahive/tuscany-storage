'use client'

import { Box, Card, CardContent, Grid, Typography } from '@mui/material'
import DescriptionIcon from '@mui/icons-material/Description'
import BusinessIcon from '@mui/icons-material/Business'
import ReceiptIcon from '@mui/icons-material/Receipt'
import GavelIcon from '@mui/icons-material/Gavel'
import NotificationsIcon from '@mui/icons-material/Notifications'
import LanguageIcon from '@mui/icons-material/Language'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import SensorsIcon from '@mui/icons-material/Sensors'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import AssignmentIcon from '@mui/icons-material/Assignment'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import Link from 'next/link'

// ── Hub card data ────────────────────────────────────────────────────────────

interface HubCard {
  title: string
  description: string
  icon: React.ReactNode
  href: string
}

const HUB_CARDS: HubCard[] = [
  {
    title: 'General',
    description: 'Locale, timezone, date format, phone & dimension display',
    icon: <LanguageIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/general',
  },
  {
    title: 'Facility Info',
    description: 'Facility name, address, contact info, access hours',
    icon: <BusinessIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/facility',
  },
  {
    title: 'Rental Settings',
    description: 'Billing period, customer permissions, prorating, reservations, lockout approval, new renter instructions',
    icon: <HomeWorkIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/rental',
  },
  {
    title: 'Fees & Charges',
    description: 'Late fees, NSF fee, auction fee configuration',
    icon: <ReceiptIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/fees',
  },
  {
    title: 'Late / Lien Settings',
    description: 'Escalation timeline, auto-fees, lockouts, notifications & auction rules',
    icon: <GavelIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/late-lien',
  },
  {
    title: 'Storage Agreement',
    description: 'Edit the rental agreement template with dynamic placeholders',
    icon: <DescriptionIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/agreement',
  },
  {
    title: 'Gate Settings',
    description: 'Gate controller integration, access codes, groups & text-to-open',
    icon: <SensorsIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/gate',
  },
  {
    title: 'Promotions',
    description: 'Create and manage discounts, promo codes & automatic offers',
    icon: <LocalOfferIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/promotions',
  },
  {
    title: 'Form Fields',
    description: 'Configure which fields are shown & required on signup and waiting list forms',
    icon: <AssignmentIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/form-fields',
  },
  {
    title: 'Notifications',
    description: 'Email and SMS notification preferences',
    icon: <NotificationsIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/notifications',
  },
]

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
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
        Setup
      </Typography>

      <Grid container spacing={3}>
        {HUB_CARDS.map((card) => (
          <Grid item xs={12} sm={6} key={card.href}>
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
                {/* Icon */}
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

                {/* Title */}
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, color: '#1C0F06', mb: 0.5 }}
                >
                  {card.title}
                </Typography>

                {/* Description */}
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', mb: 2 }}
                >
                  {card.description}
                </Typography>

                {/* Arrow */}
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
