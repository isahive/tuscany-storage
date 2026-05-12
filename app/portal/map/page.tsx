'use client'

import { Box, Card, CardContent, Typography, Button } from '@mui/material'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import PhoneIcon from '@mui/icons-material/Phone'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import DirectionsIcon from '@mui/icons-material/Directions'

export default function PortalMapPage() {
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: 'secondary.main', mb: 0.5 }}
        >
          Facility Map
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Find us at 2519 Highway 116, Caryville, TN 37714
        </Typography>
      </Box>

      {/* Map embed */}
      <Card sx={{ mb: 3, overflow: 'hidden' }}>
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3229.5!2d-84.223!3d36.297!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2s2519+Highway+116+Caryville+TN+37714!5e0!3m2!1sen!2sus!4v1"
          width="100%"
          height="420"
          style={{ border: 0, display: 'block' }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Tuscany Village Self Storage — 2519 Highway 116, Caryville, TN"
        />
      </Card>

      {/* Info cards */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
        {/* Address */}
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: '#FEF3C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <LocationOnIcon sx={{ color: '#B8914A', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1, fontSize: '0.65rem' }}>
                  Address
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mt: 0.25 }}>
                  2519 Highway 116
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Caryville, TN 37714
                </Typography>
                <Button
                  href="https://www.google.com/maps/search/?api=1&query=2519+Highway+116+Caryville+TN+37714"
                  component="a"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  startIcon={<DirectionsIcon fontSize="small" />}
                  sx={{
                    mt: 1.5,
                    px: 0,
                    color: '#B8914A',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                  }}
                >
                  Get Directions
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Phone */}
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: '#D1FAE5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <PhoneIcon sx={{ color: '#16A34A', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1, fontSize: '0.65rem' }}>
                  Phone
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mt: 0.25 }}>
                  (865) 426-2100
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Office &amp; inquiries
                </Typography>
                <Button
                  href="tel:+18654262100"
                  component="a"
                  size="small"
                  startIcon={<PhoneIcon fontSize="small" />}
                  sx={{
                    mt: 1.5,
                    px: 0,
                    color: '#16A34A',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                  }}
                >
                  Call Now
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Hours */}
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: '#DBEAFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AccessTimeIcon sx={{ color: '#1D4ED8', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1, fontSize: '0.65rem' }}>
                  Hours
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mt: 0.25 }}>
                  Gate: 24/7 Access
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Office: Mon–Sat 9am–5pm
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
                  Use your gate code anytime
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}
