'use client'

import { Box, Card, CardContent, Typography } from '@mui/material'
import Link from 'next/link'

// ── Report categories matching Storable Easy ─────────────────────────────────

interface ReportLink {
  label: string
  href: string
}

interface ReportCategory {
  title: string
  links: ReportLink[]
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    title: 'Accounting/Financials',
    links: [
      { label: 'Check Batches', href: '/admin/reports/check-batches' },
      { label: 'Lost Revenue', href: '/admin/reports/lost-revenue' },
      { label: 'Expected Revenue', href: '/admin/reports/expected-revenue' },
      { label: 'Future Revenue', href: '/admin/reports/future-revenue' },
      { label: 'Collections', href: '/admin/reports/collections' },
      { label: 'Revenues', href: '/admin/reports/revenues' },
      { label: 'Yearly Revenues', href: '/admin/reports/yearly-revenues' },
      { label: 'Monthly Deposits', href: '/admin/reports/monthly-deposits' },
      { label: 'Sales', href: '/admin/reports/sales' },
      { label: 'Sales Tax', href: '/admin/reports/sales-tax' },
      { label: 'Total Deposits', href: '/admin/reports/total-deposits' },
      { label: 'Credit Without Payment', href: '/admin/reports/credit-without-payment' },
      { label: 'Refunds', href: '/admin/reports/refunds' },
      { label: 'Failed and Declined Payments', href: '/admin/reports/failed-payments' },
      { label: 'Alterations', href: '/admin/reports/alterations' },
      { label: 'Accrual', href: '/admin/reports/accrual' },
      { label: 'Retail Sales', href: '/admin/reports/retail-sales' },
      { label: 'Rate Management Batches', href: '/admin/reports/rate-management-batches' },
      { label: 'Occupancy', href: '/admin/reports/occupancy' },
      { label: 'Occupancy History', href: '/admin/reports/occupancy-history' },
      { label: 'Recurring Fees', href: '/admin/reports/recurring-fees' },
      { label: 'Daily Close Batches', href: '/admin/reports/daily-close' },
    ],
  },
  {
    title: 'Customers',
    links: [
      { label: 'Tenant Credit', href: '/admin/reports/tenant-credit' },
      { label: 'Reservations', href: '/admin/reports/reservations' },
      { label: 'Next Bill Due', href: '/admin/reports/next-bill-due' },
      { label: 'Move In / Move Out', href: '/admin/reports/move-in-out' },
      { label: 'Scheduled Move Outs', href: '/admin/reports/scheduled-move-outs' },
      { label: 'Waiting List', href: '/admin/reports/waiting-list' },
      { label: 'Lock Outs', href: '/admin/reports/lockouts' },
      { label: 'Tenant Data', href: '/admin/reports/tenant-data' },
      { label: 'Rental Transfers', href: '/admin/reports/rental-transfers' },
      { label: 'Storage Agreements', href: '/admin/reports/storage-agreements' },
      { label: 'Undelivered Notifications', href: '/admin/reports/undelivered-notifications' },
      { label: 'Customer Notes', href: '/admin/reports/customer-notes' },
      { label: 'Credit Card Expiration Dates', href: '/admin/reports/cc-expiration' },
      { label: 'Active Promotions', href: '/admin/reports/active-promotions' },
    ],
  },
  {
    title: 'Payments and Deposits',
    links: [
      { label: 'Transactions', href: '/admin/reports/transactions' },
      { label: 'Bank Activity', href: '/admin/reports/bank-activity' },
      { label: 'Statements', href: '/admin/reports/statements' },
      { label: 'Chargebacks', href: '/admin/reports/chargebacks' },
    ],
  },
  {
    title: 'Facility',
    links: [
      { label: 'Access Codes', href: '/admin/reports/access-codes' },
      { label: 'Gate Activity Log', href: '/admin/reports/gate-activity' },
      { label: 'Unit List', href: '/admin/reports/unit-list' },
      { label: 'Management Summary', href: '/admin/reports/management-summary' },
      { label: 'Tenant Protection', href: '/admin/reports/tenant-protection' },
      { label: 'Tenant Protection - Revenue', href: '/admin/reports/tenant-protection-revenue' },
      { label: 'Declined Tenant Protection', href: '/admin/reports/declined-tenant-protection' },
      { label: 'Unit Notes', href: '/admin/reports/unit-notes' },
      { label: 'Rent Roll', href: '/admin/reports/rent-roll' },
      { label: 'Square Footage', href: '/admin/reports/square-footage' },
      { label: 'Retail Inventory Summary', href: '/admin/reports/retail-inventory' },
      { label: 'Tasks', href: '/admin/reports/tasks' },
      { label: 'Custom Fields', href: '/admin/reports/custom-fields' },
      { label: 'Unit Status', href: '/admin/reports/unit-status' },
      { label: 'Length of Stay', href: '/admin/reports/length-of-stay' },
      { label: 'Vacant Units', href: '/admin/reports/vacant-units' },
      { label: 'Self Insured Rentals', href: '/admin/reports/self-insured-rentals' },
    ],
  },
]

// ── Page ────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  return (
    <Box>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          color: '#B8914A',
          fontFamily: '"Playfair Display", serif',
          mb: 0.5,
        }}
      >
        Reports
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Home &nbsp;/&nbsp; Reports
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {REPORT_CATEGORIES.map((cat) => (
          <Card
            key={cat.title}
            sx={{
              border: '1px solid #EDE5D8',
              boxShadow: 'none',
              borderRadius: 2,
            }}
          >
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              {/* Category header */}
              <Box
                sx={{
                  px: 2.5,
                  py: 1.5,
                  borderBottom: '3px solid #B8914A',
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, color: '#1C0F06' }}
                >
                  {cat.title}
                </Typography>
              </Box>

              {/* Links */}
              <Box sx={{ px: 2.5, py: 1.5 }}>
                {cat.links.map((link) => (
                  <Typography
                    key={link.href}
                    variant="body2"
                    component={Link}
                    href={link.href}
                    sx={{
                      color: '#B8914A',
                      cursor: 'pointer',
                      py: 0.5,
                      display: 'block',
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline', color: '#A5623A' },
                      '&:focus-visible': {
                        outline: '2px solid #B8914A',
                        outlineOffset: 2,
                        borderRadius: 0.5,
                      },
                    }}
                  >
                    {link.label}
                  </Typography>
                ))}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
