'use client'

import { useState, useEffect } from 'react'
import { SessionProvider, useSession, signOut } from 'next-auth/react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import {
  Alert,
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Button,
  Divider,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PaymentIcon from '@mui/icons-material/Payment'
import LockIcon from '@mui/icons-material/Lock'
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import PersonIcon from '@mui/icons-material/Person'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import LogoutIcon from '@mui/icons-material/Logout'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { usePathname, useRouter } from 'next/navigation'
import { theme } from '@/lib/theme'

const DRAWER_WIDTH = 240

const BASE_NAV_ITEMS = [
  { label: 'Dashboard',    href: '/portal',              icon: <DashboardIcon /> },
  { label: 'Payments',     href: '/portal/payments',     icon: <PaymentIcon /> },
  { label: 'Gate Code',    href: '/portal/gate-code',    icon: <LockIcon />, key: 'gateCode' },
  { label: 'My Profile',   href: '/portal/profile',      icon: <PersonIcon /> },
  { label: 'Billing',      href: '/portal/billing',      icon: <CreditCardIcon /> },
  { label: 'Instructions', href: '/portal/instructions', icon: <InfoOutlinedIcon /> },
  { label: 'Move Out',     href: '/portal/move-out',     icon: <MoveToInboxIcon />, key: 'moveOut' },
]

function DrawerContent({ canScheduleMoveOuts, leaseSigned }: { canScheduleMoveOuts: boolean; leaseSigned: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  const navItems = BASE_NAV_ITEMS.filter(
    (item) =>
      (item.key !== 'moveOut' || canScheduleMoveOuts) &&
      (item.key !== 'gateCode' || leaseSigned),
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ bgcolor: 'secondary.main', px: 2 }}>
        <Typography
          variant="subtitle1"
          sx={{
            color: 'white',
            fontFamily: '"Playfair Display", serif',
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          Tuscany Village
          <br />
          <Box component="span" sx={{ fontSize: '0.75rem', fontFamily: '"DM Sans", sans-serif', fontWeight: 400, opacity: 0.8 }}>
            Self Storage
          </Box>
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, pt: 1 }}>
        {navItems.map((item) => {
          const selected = pathname === item.href
          return (
            <ListItem key={item.href} disablePadding>
              <ListItemButton
                selected={selected}
                onClick={() => router.push(item.href)}
                sx={{
                  mx: 1,
                  borderRadius: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'secondary.main',
                    '& .MuiListItemIcon-root': { color: 'secondary.main' },
                    '&:hover': { bgcolor: 'primary.main' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: selected ? 'secondary.main' : 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: selected ? 600 : 400, fontSize: '0.9rem' }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={() => signOut({ callbackUrl: '/login' })}
          sx={{ color: 'text.secondary', justifyContent: 'flex-start' }}
        >
          Sign out
        </Button>
      </Box>
    </Box>
  )
}

function PortalShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const muiTheme = useTheme()
  const isDesktop = useMediaQuery(muiTheme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [canScheduleMoveOuts, setCanScheduleMoveOuts] = useState(true)
  const [leaseInfo, setLeaseInfo] = useState<{ signedAt: string | null; leaseId: string; unitId: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setCanScheduleMoveOuts(j.data.customersCanScheduleMoveOuts ?? true)
        }
      })
      .catch(() => {/* keep default true */})
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    fetch('/api/portal/active-lease')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setLeaseInfo({ signedAt: j.data.signedAt ?? null, leaseId: j.data.leaseId, unitId: j.data.unitId ?? '' })
        }
      })
      .catch(() => {/* ignore */})
  }, [session?.user?.id])

  const leaseSigned = leaseInfo?.signedAt != null

  const tenantName = session?.user?.name ?? 'Tenant'
  const initials = tenantName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: 'white',
          borderBottom: '1px solid #EDE5D8',
          zIndex: (t) => t.zIndex.drawer + 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar>
          {!isDesktop && (
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1, color: 'secondary.main' }}
              aria-label="Toggle navigation"
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="body1" sx={{ flexGrow: 1, color: 'text.secondary', fontSize: '0.875rem' }}>
            My Storage Account
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, display: { xs: 'none', sm: 'block' } }}>
              {tenantName}
            </Typography>
            <Avatar
              sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: 'secondary.main', fontSize: '0.8rem', fontWeight: 700 }}
            >
              {initials}
            </Avatar>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <DrawerContent canScheduleMoveOuts={canScheduleMoveOuts} leaseSigned={leaseSigned} />
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid #EDE5D8',
          },
        }}
        open
      >
        <DrawerContent canScheduleMoveOuts={canScheduleMoveOuts} leaseSigned={leaseSigned} />
      </Drawer>

      {/* Page content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          mt: '64px',
          ml: { md: `${DRAWER_WIDTH}px` },
          minWidth: 0,
        }}
      >
        {leaseInfo && !leaseSigned && (
          <Alert
            severity="warning"
            icon={<WarningAmberIcon />}
            sx={{ mb: 3 }}
            action={
              <Button
                color="inherit"
                size="small"
                href={`/reserve/${leaseInfo.unitId}`}
                sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                Sign now →
              </Button>
            }
          >
            <strong>Your lease is not signed yet.</strong> Please sign your storage agreement to activate your access.
          </Alert>
        )}
        {children}
      </Box>
    </Box>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <PortalShell>{children}</PortalShell>
      </ThemeProvider>
    </SessionProvider>
  )
}
