'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'

/**
 * Renders the post-move-in welcome pop-up Storable shows after a tenant
 * completes online rental. Triggered by the `?welcome=1` query param the
 * reserve page sets on success (see app/(public)/reserve/[unitId]/page.tsx).
 *
 * Body text comes from Settings.newRenterInstructions — when blank, falls
 * back to a generic welcome line so the dialog still gives the tenant a
 * confirmation moment.
 *
 * On close we strip the query param via replaceState so a refresh doesn't
 * pop the dialog twice.
 */
export default function MoveInCompleteDialog() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isWelcome = searchParams?.get('welcome') === '1'

  const [open, setOpen] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [facilityName, setFacilityName] = useState('')

  useEffect(() => {
    if (!isWelcome) return
    setOpen(true)
    let cancelled = false
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.success) return
        setInstructions(json.data.newRenterInstructions ?? '')
        setFacilityName(json.data.facilityName ?? '')
      })
      .catch(() => { /* fall back to default copy below */ })
    return () => { cancelled = true }
  }, [isWelcome])

  function handleClose() {
    setOpen(false)
    // Drop ?welcome=1 so a refresh doesn't reopen the dialog. Use replaceState
    // instead of router.replace so we don't re-render the dashboard.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('welcome')
      window.history.replaceState({}, '', url.toString())
    }
  }

  if (!isWelcome) return null

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#1C0F06' }}>
        <CheckCircleOutlineIcon sx={{ color: '#10B981' }} />
        Welcome to {facilityName || 'Tuscany Village Self Storage'}!
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: '#5C5347', mb: 2 }}>
          Your rental is complete. A confirmation email and text with your access details has
          been sent.
        </Typography>
        {instructions ? (
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#1C0F06' }}>
            {instructions}
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: '#5C5347' }}>
            You can review your rental details and pay your balance from this dashboard at any time.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          variant="contained"
          onClick={handleClose}
          sx={{ bgcolor: '#B8914A', '&:hover': { bgcolor: '#9A7A3E' }, textTransform: 'none', fontWeight: 600 }}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  )
}
