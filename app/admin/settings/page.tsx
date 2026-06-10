'use client'

import { useMemo, useState } from 'react'
import { Box, Card, CardContent, Grid, InputAdornment, TextField, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import DescriptionIcon from '@mui/icons-material/Description'
import BusinessIcon from '@mui/icons-material/Business'
import ReceiptIcon from '@mui/icons-material/Receipt'
import GavelIcon from '@mui/icons-material/Gavel'
import NotificationsIcon from '@mui/icons-material/Notifications'
import LanguageIcon from '@mui/icons-material/Language'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import SensorsIcon from '@mui/icons-material/Sensors'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import AssignmentIcon from '@mui/icons-material/Assignment'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import Link from 'next/link'

// ── Hub card data ────────────────────────────────────────────────────────────

interface HubCard {
  title: string
  description: string
  icon: React.ReactNode
  href: string
  /** Extra search terms so a setting buried inside a page is still findable. */
  keywords: string
}

const HUB_CARDS: HubCard[] = [
  {
    title: 'General',
    description: 'Locale, timezone, date format, phone & dimension display',
    icon: <LanguageIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/general',
    keywords: 'locale language timezone time zone date format currency phone format dimension units name format',
  },
  {
    title: 'Facility Info',
    description: 'Facility name, address, contact info, access hours',
    icon: <BusinessIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/facility',
    keywords: 'facility name address contact email phone access hours location business',
  },
  {
    title: 'Rental Settings',
    description: 'Billing period, customer permissions, prorating, reservations, lockout approval, new renter instructions',
    icon: <HomeWorkIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/rental',
    keywords: 'sales tax tax rate billing cycle billing period proration prorating reservations customer permissions lockout approval new renter instructions',
  },
  {
    title: 'Fees & Charges',
    description: 'Late fees, NSF fee, auction fee configuration',
    icon: <ReceiptIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/fees',
    keywords: 'late fee nsf fee auction fee charges insufficient funds',
  },
  {
    title: 'Late / Lien Settings',
    description: 'Escalation timeline, auto-fees, lockouts, notifications & auction rules',
    icon: <GavelIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/late-lien',
    keywords: 'delinquency escalation pre-lien lien auction lockout overlock notifications timeline',
  },
  {
    title: 'Storage Agreement',
    description: 'Edit the rental agreement template with dynamic placeholders',
    icon: <DescriptionIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/agreement',
    keywords: 'lease rental agreement contract template placeholders signature terms',
  },
  {
    title: 'Gate Settings',
    description: 'Gate controller integration, access codes, groups & text-to-open',
    icon: <SensorsIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/gate',
    keywords: 'gate access codes pdk controller groups text to open sms keypad entry',
  },
  {
    title: 'Promotions',
    description: 'Create and manage discounts, promo codes & automatic offers',
    icon: <LocalOfferIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/promotions',
    keywords: 'promotion discount promo code coupon automatic offer move-in special half off',
  },
  {
    title: 'Protection Plans',
    description: 'Manage tenant protection plan tiers shown during rental',
    icon: <ShieldOutlinedIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/protection-plans',
    keywords: 'tenant protection insurance coverage plan tiers',
  },
  {
    title: 'Form Fields',
    description: 'Configure which fields are shown & required on signup and waiting list forms',
    icon: <AssignmentIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/form-fields',
    keywords: 'form fields signup required custom fields waiting list address',
  },
  {
    title: 'Notifications',
    description: 'Email and SMS notification preferences',
    icon: <NotificationsIcon sx={{ color: 'white', fontSize: 28 }} />,
    href: '/admin/settings/notifications',
    keywords: 'notifications email sms text alerts reminders preferences',
  },
]

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return HUB_CARDS
    return HUB_CARDS.filter((c) =>
      `${c.title} ${c.description} ${c.keywords}`.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          color: '#2C3826',
          fontFamily: 'var(--font-outfit), system-ui, sans-serif',
          mb: 2,
        }}
      >
        Setup
      </Typography>

      {/* Search settings */}
      <TextField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search settings… (e.g. tax, gate, late fee)"
        size="small"
        fullWidth
        sx={{ maxWidth: 480, mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
        }}
      />

      {filtered.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', py: 4 }}>
          No settings match &ldquo;{query}&rdquo;.
        </Typography>
      ) : (
      <Grid container spacing={3}>
        {filtered.map((card) => (
          <Grid item xs={12} sm={6} key={card.href}>
            <Card
              component={Link}
              href={card.href}
              tabIndex={0}
              role="link"
              sx={{
                border: '1px solid #E5E7EB',
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
                  sx={{ fontWeight: 700, color: '#2C3826', mb: 0.5 }}
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
      )}
    </Box>
  )
}
