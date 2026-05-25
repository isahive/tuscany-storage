import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary:   { main: '#8CA87C', contrastText: '#FFFFFF' }, // olive (accent / selected)
    secondary: { main: '#2C3826', contrastText: '#FFFFFF' }, // dark forest olive (sidebar header, table heads)
    background:{ default: '#FAF7F2', paper: '#FFFFFF' },
    text:      { primary: '#1F2937', secondary: '#6B7280' },
    error:     { main: '#DC2626' },
    success:   { main: '#16A34A' },
    warning:   { main: '#D97706' },
  },
  typography: {
    // Reference the CSS variables set by app/layout.tsx (cascade from <html>).
    // System-ui fallback keeps things legible if the variable is undefined.
    fontFamily: 'var(--font-inter), system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    h1: { fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 700 },
    h2: { fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 700 },
    h3: { fontFamily: 'var(--font-outfit), system-ui, sans-serif', fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 4 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { border: '1px solid #E5E7EB', boxShadow: 'none' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#2C3826',
            color: '#FFFFFF',
            fontWeight: 600,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4 },
      },
    },
  },
})
