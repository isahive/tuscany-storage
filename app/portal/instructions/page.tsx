import { Box, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { getSettings } from '@/lib/getSettings'

export default async function NewRenterInstructionsPage() {
  const settings = await getSettings()

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <InfoOutlinedIcon sx={{ color: '#B8914A', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06' }}>
          New Renter Instructions
        </Typography>
      </Box>

      <Box
        sx={{
          bgcolor: 'white',
          border: '1px solid #EDE5D8',
          borderRadius: 2,
          p: 3,
          maxWidth: 680,
        }}
      >
        <Typography
          variant="body1"
          sx={{ color: '#1C0F06', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}
        >
          {settings.newRenterInstructions || 'No instructions have been set yet. Please contact the facility for details.'}
        </Typography>
      </Box>
    </Box>
  )
}
