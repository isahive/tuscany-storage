import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary:   { main: '#9E7B3C', contrastText: '#1C0F06' },
    secondary: { main: '#1C0F06', contrastText: '#FFFFFF' },
    background:{ default: '#FAF7F2', paper: '#FFFFFF' },
    text:      { primary: '#1C0F06', secondary: '#6B7280' },
    error:     { main: '#DC2626' },
    success:   { main: '#16A34A' },
    warning:   { main: '#D97706' },
  },
  typography: {
    fontFamily: '"DM Sans", "Arial", sans-serif',
    h1: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h2: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h3: { fontFamily: '"Playfair Display", serif', fontWeight: 500 },
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
        root: { border: '1px solid #EDE5D8', boxShadow: 'none' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#1C0F06',
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
