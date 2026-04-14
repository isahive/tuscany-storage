'use client'

import { useState } from 'react'
import { SessionProvider, useSession, signOut } from 'next-auth/react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import {
  AppBar,
  Box,
  Breadcrumbs,
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
  Link as MuiLink,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import PaymentIcon from '@mui/icons-material/Payment'
import WarningIcon from '@mui/icons-material/Warning'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ListAltIcon from '@mui/icons-material/ListAlt'
import SettingsIcon from '@mui/icons-material/Settings'
import ExitToAppIcon from '@mui/icons-material/ExitToApp'
import StorefrontIcon from '@mui/icons-material/Storefront'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import AssessmentIcon from '@mui/icons-material/Assessment'
import EmailIcon from '@mui/icons-material/Email'
import LogoutIcon from '@mui/icons-material/Logout'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import { usePathname, useRouter } from 'next/navigation'
import { theme } from '@/lib/theme'

const DRAWER_WIDTH = 280

const NAV_ITEMS = [
  { label: 'Dashboard',       href: '/admin',                   icon: <DashboardIcon /> },
  { label: 'Tenants',         href: '/admin/tenants',           icon: <PeopleIcon /> },
  { label: 'Units',           href: '/admin/units',             icon: <WarehouseIcon /> },
  { label: 'Payments',        href: '/admin/payments',          icon: <PaymentIcon /> },
  { label: 'Delinquency',     href: '/admin/delinquency',       icon: <WarningIcon /> },
  { label: 'Rate Management', href: '/admin/rate-management',   icon: <TrendingUpIcon /> },
  { label: 'Waiting List',    href: '/admin/waiting-list',      icon: <ListAltIcon /> },
  { label: 'Retail Sale',     href: '/admin/retail',            icon: <StorefrontIcon /> },
  { label: 'New Quote',       href: '/admin/quotes',            icon: <RequestQuoteIcon /> },
  { label: 'Move Out',        href: '/admin/move-out',          icon: <ExitToAppIcon /> },
  { label: 'Email, Txt & Print', href: '/admin/communications',  icon: <EmailIcon /> },
  { label: 'Reports',         href: '/admin/reports',           icon: <AssessmentIcon /> },
  { label: 'Setup',           href: '/admin/settings',          icon: <SettingsIcon /> },
]

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; href: string }[] = []
  let acc = ''
  for (const seg of segments) {
    acc += `/${seg}`
    const nav = NAV_ITEMS.find((n) => n.href === acc)
    if (nav) {
      crumbs.push({ label: nav.label, href: acc })
    } else {
      // dynamic segment — capitalise and strip brackets
      const label = seg.startsWith('[') ? 'Detail' : seg.charAt(0).toUpperCase() + seg.slice(1)
      crumbs.push({ label, href: acc })
    }
  }
  return crumbs
}

function DrawerContent() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar
        sx={{
          bgcolor: 'secondary.main',
          px: 2,
          minHeight: '64px !important',
        }}
      >
        <Box>
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
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'rgba(255,255,255,0.7)', fontFamily: '"DM Sans", sans-serif' }}
          >
            Admin Panel
          </Typography>
        </Box>
      </Toolbar>

      <Divider />

      <List sx={{ flex: 1, pt: 1, px: 0.5 }}>
        {NAV_ITEMS.map((item) => {
          const selected =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
          return (
            <ListItem key={item.href} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                selected={selected}
                onClick={() => router.push(item.href)}
                sx={{
                  borderRadius: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'secondary.main',
                    '& .MuiListItemIcon-root': { color: 'secondary.main' },
                    '&:hover': { bgcolor: 'primary.main' },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: selected ? 'secondary.main' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: selected ? 600 : 400,
                    fontSize: '0.875rem',
                  }}
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

function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const muiTheme = useTheme()
  const isDesktop = useMediaQuery(muiTheme.breakpoints.up('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const adminName = session?.user?.name ?? 'Administrator'
  const initials = adminName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const breadcrumbs = buildBreadcrumbs(pathname)

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
        <Toolbar sx={{ gap: 1 }}>
          {!isDesktop && (
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1, color: 'secondary.main' }}
              aria-label="Toggle navigation menu"
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Breadcrumbs */}
          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
            sx={{ flex: 1 }}
          >
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1
              return isLast ? (
                <Typography
                  key={crumb.href}
                  variant="body2"
                  sx={{ color: 'text.primary', fontWeight: 500 }}
                >
                  {crumb.label}
                </Typography>
              ) : (
                <MuiLink
                  key={crumb.href}
                  component="button"
                  variant="body2"
                  underline="hover"
                  onClick={() => router.push(crumb.href)}
                  sx={{ color: 'text.secondary', cursor: 'pointer' }}
                >
                  {crumb.label}
                </MuiLink>
              )
            })}
          </Breadcrumbs>

          {/* Admin identity */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{
                color: 'text.primary',
                fontWeight: 500,
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {adminName}
            </Typography>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: 'secondary.main',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>
            <Button
              size="small"
              startIcon={<LogoutIcon fontSize="small" />}
              onClick={() => signOut({ callbackUrl: '/login' })}
              sx={{
                color: 'text.secondary',
                display: { xs: 'none', sm: 'flex' },
                ml: 0.5,
              }}
            >
              Logout
            </Button>
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
        <DrawerContent />
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
        <DrawerContent />
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
        {children}
      </Box>
    </Box>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AdminShell>{children}</AdminShell>
      </ThemeProvider>
    </SessionProvider>
  )
}
