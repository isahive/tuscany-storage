'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import FilterListIcon from '@mui/icons-material/FilterList'

// ── Column definitions per report type ──────────────────────────────────────

interface ColDef {
  key: string
  label: string
  format?: 'money' | 'date' | 'percent' | 'text'
  width?: number
  align?: 'left' | 'center' | 'right'
}

interface ReportConfig {
  title: string
  apiType: string
  columns: ColDef[]
  showDateFilter?: boolean
}

const CONFIGS: Record<string, ReportConfig> = {
  revenues: {
    title: 'Revenues',
    apiType: 'revenues',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'type', label: 'Type' },
      { key: 'method', label: 'Method' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'description', label: 'Description' },
    ],
  },
  'yearly-revenues': {
    title: 'Yearly Revenues',
    apiType: 'revenues',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
    ],
  },
  'monthly-deposits': {
    title: 'Monthly Deposits',
    apiType: 'revenues',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'method', label: 'Method' },
    ],
  },
  sales: {
    title: 'Sales',
    apiType: 'revenues',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
    ],
  },
  'sales-tax': {
    title: 'Sales Tax',
    apiType: 'sales-tax',
    showDateFilter: true,
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'totalSales', label: 'Total Sales', format: 'money', align: 'right' },
      { key: 'estimatedTax', label: 'Estimated Tax', format: 'money', align: 'right' },
    ],
  },
  'total-deposits': {
    title: 'Total Deposits',
    apiType: 'revenues',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'method', label: 'Method' },
    ],
  },
  refunds: {
    title: 'Refunds',
    apiType: 'refunds',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'type', label: 'Type' },
      { key: 'method', label: 'Method' },
    ],
  },
  'retail-sales': {
    title: 'Retail Sales',
    apiType: 'retail-sales',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'description', label: 'Description' },
    ],
  },
  occupancy: {
    title: 'Occupancy',
    apiType: 'occupancy',
    columns: [
      { key: 'type', label: 'Unit Type' },
      { key: 'total', label: 'Total Units', align: 'center' },
      { key: 'occupied', label: 'Occupied', align: 'center' },
      { key: 'available', label: 'Available', align: 'center' },
      { key: 'rate', label: 'Occupancy %', format: 'percent', align: 'right' },
    ],
  },
  'occupancy-history': {
    title: 'Occupancy History',
    apiType: 'occupancy',
    columns: [
      { key: 'type', label: 'Unit Type' },
      { key: 'total', label: 'Total', align: 'center' },
      { key: 'occupied', label: 'Occupied', align: 'center' },
      { key: 'rate', label: 'Rate %', format: 'percent', align: 'right' },
    ],
  },
  'recurring-fees': {
    title: 'Recurring Fees',
    apiType: 'rent-roll',
    columns: [
      { key: 'unit', label: 'Unit' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'monthlyRate', label: 'Monthly Rate', format: 'money', align: 'right' },
      { key: 'billingDay', label: 'Billing Day', align: 'center' },
    ],
  },
  'daily-close': {
    title: 'Daily Close Batches',
    apiType: 'daily-close',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'transactions', label: 'Transactions', align: 'center' },
      { key: 'total', label: 'Total', format: 'money', align: 'right' },
    ],
  },
  'tenant-credit': {
    title: 'Tenant Credit',
    apiType: 'tenant-credit',
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit' },
      { key: 'credit', label: 'Credit', format: 'money', align: 'right' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
    ],
  },
  reservations: {
    title: 'Reservations',
    apiType: 'reservations',
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'email', label: 'Email' },
      { key: 'unit', label: 'Unit' },
      { key: 'size', label: 'Size' },
      { key: 'rate', label: 'Rate', format: 'money', align: 'right' },
    ],
  },
  'next-bill-due': {
    title: 'Next Bill Due',
    apiType: 'next-bill-due',
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit' },
      { key: 'rate', label: 'Monthly Rate', format: 'money', align: 'right' },
      { key: 'billingDay', label: 'Billing Day', align: 'center' },
      { key: 'nextDue', label: 'Next Due', format: 'date' },
      { key: 'balance', label: 'Balance', format: 'money', align: 'right' },
    ],
  },
  'move-in-out': {
    title: 'Move In / Move Out',
    apiType: 'move-in-out',
    showDateFilter: true,
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit' },
      { key: 'size', label: 'Size' },
      { key: 'moveIn', label: 'Move In', format: 'date' },
      { key: 'moveOut', label: 'Move Out', format: 'date' },
      { key: 'status', label: 'Status' },
      { key: 'rate', label: 'Rate', format: 'money', align: 'right' },
    ],
  },
  'scheduled-move-outs': {
    title: 'Scheduled Move Outs',
    apiType: 'scheduled-move-outs',
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit' },
      { key: 'requestedDate', label: 'Move Out Date', format: 'date' },
      { key: 'status', label: 'Status' },
      { key: 'reason', label: 'Reason' },
    ],
  },
  'waiting-list': {
    title: 'Waiting List',
    apiType: 'waiting-list',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'preferredSize', label: 'Preferred Size' },
      { key: 'preferredType', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Added', format: 'date' },
    ],
  },
  lockouts: {
    title: 'Lock Outs',
    apiType: 'lockouts',
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'balance', label: 'Balance', format: 'money', align: 'right' },
    ],
  },
  'tenant-data': {
    title: 'Tenant Data',
    apiType: 'tenant-data',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'status', label: 'Status' },
      { key: 'balance', label: 'Balance', format: 'money', align: 'right' },
      { key: 'createdAt', label: 'Created', format: 'date' },
    ],
  },
  'storage-agreements': {
    title: 'Storage Agreements',
    apiType: 'storage-agreements',
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit' },
      { key: 'signedAt', label: 'Signed', format: 'date' },
      { key: 'startDate', label: 'Start', format: 'date' },
      { key: 'rate', label: 'Rate', format: 'money', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
  },
  'customer-notes': {
    title: 'Customer Notes',
    apiType: 'customer-notes',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'content', label: 'Note' },
      { key: 'createdBy', label: 'By' },
    ],
  },
  'active-promotions': {
    title: 'Active Promotions',
    apiType: 'active-promotions',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      { key: 'type', label: 'Type' },
      { key: 'value', label: 'Value', align: 'right' },
      { key: 'usageCount', label: 'Used', align: 'center' },
      { key: 'startDate', label: 'Start', format: 'date' },
      { key: 'endDate', label: 'End', format: 'date' },
    ],
  },
  transactions: {
    title: 'Transactions',
    apiType: 'transactions',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'type', label: 'Type' },
      { key: 'method', label: 'Method' },
      { key: 'status', label: 'Status' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'description', label: 'Description' },
    ],
  },
  'bank-activity': {
    title: 'Bank Activity',
    apiType: 'bank-activity',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'method', label: 'Method' },
      { key: 'stripeId', label: 'Stripe ID' },
    ],
  },
  statements: {
    title: 'Statements',
    apiType: 'transactions',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
  },
  'access-codes': {
    title: 'Access Codes',
    apiType: 'access-codes',
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit' },
      { key: 'gateCode', label: 'Gate Code' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
    ],
  },
  'gate-activity': {
    title: 'Gate Activity Log',
    apiType: 'gate-activity',
    showDateFilter: true,
    columns: [
      { key: 'timestamp', label: 'Time', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'event', label: 'Event' },
      { key: 'source', label: 'Source' },
      { key: 'code', label: 'Code' },
    ],
  },
  'unit-list': {
    title: 'Unit List',
    apiType: 'unit-list',
    columns: [
      { key: 'unitNumber', label: 'Unit #' },
      { key: 'size', label: 'Size' },
      { key: 'sqft', label: 'Sq Ft', align: 'right' },
      { key: 'type', label: 'Type' },
      { key: 'floor', label: 'Floor' },
      { key: 'price', label: 'Price', format: 'money', align: 'right' },
      { key: 'status', label: 'Status' },
    ],
  },
  'management-summary': {
    title: 'Management Summary',
    apiType: 'management-summary',
    columns: [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value', align: 'right' },
    ],
  },
  'rent-roll': {
    title: 'Rent Roll',
    apiType: 'rent-roll',
    columns: [
      { key: 'unit', label: 'Unit' },
      { key: 'size', label: 'Size' },
      { key: 'type', label: 'Type' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'monthlyRate', label: 'Monthly Rate', format: 'money', align: 'right' },
      { key: 'deposit', label: 'Deposit', format: 'money', align: 'right' },
      { key: 'billingDay', label: 'Billing Day', align: 'center' },
      { key: 'startDate', label: 'Start', format: 'date' },
      { key: 'balance', label: 'Balance', format: 'money', align: 'right' },
    ],
  },
  'square-footage': {
    title: 'Square Footage',
    apiType: 'square-footage',
    columns: [
      { key: 'type', label: 'Unit Type' },
      { key: 'units', label: 'Units', align: 'center' },
      { key: 'totalSqft', label: 'Total Sq Ft', align: 'right' },
      { key: 'occupiedSqft', label: 'Occupied Sq Ft', align: 'right' },
      { key: 'occupiedUnits', label: 'Occupied Units', align: 'center' },
    ],
  },
  'retail-inventory': {
    title: 'Retail Inventory Summary',
    apiType: 'retail-inventory',
    columns: [
      { key: 'name', label: 'Product' },
      { key: 'price', label: 'Price', format: 'money', align: 'right' },
      { key: 'cost', label: 'Cost', format: 'money', align: 'right' },
      { key: 'taxRate', label: 'Tax %', format: 'percent', align: 'right' },
      { key: 'inventory', label: 'Stock', align: 'center' },
      { key: 'margin', label: 'Margin %', format: 'percent', align: 'right' },
      { key: 'active', label: 'Active' },
    ],
  },
  'unit-status': {
    title: 'Unit Status',
    apiType: 'unit-status',
    columns: [
      { key: 'unitNumber', label: 'Unit #' },
      { key: 'size', label: 'Size' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'price', label: 'Price', format: 'money', align: 'right' },
    ],
  },
  'length-of-stay': {
    title: 'Length of Stay',
    apiType: 'length-of-stay',
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit' },
      { key: 'size', label: 'Size' },
      { key: 'startDate', label: 'Move In', format: 'date' },
      { key: 'months', label: 'Months', align: 'center' },
      { key: 'rate', label: 'Rate', format: 'money', align: 'right' },
    ],
  },
  'vacant-units': {
    title: 'Vacant Units',
    apiType: 'vacant-units',
    columns: [
      { key: 'unitNumber', label: 'Unit #' },
      { key: 'size', label: 'Size' },
      { key: 'sqft', label: 'Sq Ft', align: 'right' },
      { key: 'type', label: 'Type' },
      { key: 'floor', label: 'Floor' },
      { key: 'price', label: 'Price', format: 'money', align: 'right' },
      { key: 'features', label: 'Features' },
    ],
  },
  // ── Additional Accounting/Financials reports ──────────────────────────
  'check-batches': {
    title: 'Check Batches',
    apiType: 'transactions',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'method', label: 'Method' },
      { key: 'status', label: 'Status' },
    ],
  },
  'lost-revenue': {
    title: 'Lost Revenue',
    apiType: 'vacant-units',
    columns: [
      { key: 'unitNumber', label: 'Unit #' },
      { key: 'size', label: 'Size' },
      { key: 'type', label: 'Type' },
      { key: 'price', label: 'Potential Monthly Revenue', format: 'money', align: 'right' },
    ],
  },
  'expected-revenue': {
    title: 'Expected Revenue',
    apiType: 'rent-roll',
    columns: [
      { key: 'unit', label: 'Unit' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'monthlyRate', label: 'Expected Revenue', format: 'money', align: 'right' },
      { key: 'billingDay', label: 'Billing Day', align: 'center' },
    ],
  },
  'future-revenue': {
    title: 'Future Revenue',
    apiType: 'rent-roll',
    columns: [
      { key: 'unit', label: 'Unit' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'monthlyRate', label: 'Monthly Rate', format: 'money', align: 'right' },
      { key: 'startDate', label: 'Start Date', format: 'date' },
    ],
  },
  collections: {
    title: 'Collections',
    apiType: 'lockouts',
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit' },
      { key: 'balance', label: 'Amount Due', format: 'money', align: 'right' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
    ],
  },
  'credit-without-payment': {
    title: 'Credit Without Payment',
    apiType: 'tenant-credit',
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit' },
      { key: 'credit', label: 'Credit Amount', format: 'money', align: 'right' },
      { key: 'email', label: 'Email' },
    ],
  },
  'failed-payments': {
    title: 'Failed and Declined Payments',
    apiType: 'transactions',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'method', label: 'Method' },
      { key: 'status', label: 'Status' },
    ],
  },
  alterations: {
    title: 'Alterations',
    apiType: 'transactions',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'description', label: 'Description' },
    ],
  },
  accrual: {
    title: 'Accrual',
    apiType: 'rent-roll',
    columns: [
      { key: 'unit', label: 'Unit' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'monthlyRate', label: 'Accrued Amount', format: 'money', align: 'right' },
      { key: 'billingDay', label: 'Billing Day', align: 'center' },
      { key: 'balance', label: 'Balance', format: 'money', align: 'right' },
    ],
  },
  'rate-management-batches': {
    title: 'Rate Management Batches',
    apiType: 'rent-roll',
    columns: [
      { key: 'unit', label: 'Unit' },
      { key: 'size', label: 'Size' },
      { key: 'type', label: 'Type' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'monthlyRate', label: 'Current Rate', format: 'money', align: 'right' },
      { key: 'startDate', label: 'Start Date', format: 'date' },
    ],
  },
  // ── Additional Customer reports ───────────────────────────────────────
  'rental-transfers': {
    title: 'Rental Transfers',
    apiType: 'move-in-out',
    showDateFilter: true,
    columns: [
      { key: 'tenant', label: 'Tenant' },
      { key: 'unit', label: 'Unit' },
      { key: 'size', label: 'Size' },
      { key: 'moveIn', label: 'Move In', format: 'date' },
      { key: 'status', label: 'Status' },
      { key: 'rate', label: 'Rate', format: 'money', align: 'right' },
    ],
  },
  'undelivered-notifications': {
    title: 'Undelivered Notifications',
    apiType: 'transactions', // placeholder — will show empty until notification tracking is added
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
    ],
  },
  'cc-expiration': {
    title: 'Credit Card Expiration Dates',
    apiType: 'tenant-data',
    columns: [
      { key: 'name', label: 'Tenant' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
    ],
  },
  // ── Additional Payment reports ────────────────────────────────────────
  chargebacks: {
    title: 'Chargebacks',
    apiType: 'refunds',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'type', label: 'Type' },
      { key: 'method', label: 'Method' },
    ],
  },
  // ── Additional Facility reports ───────────────────────────────────────
  'tenant-protection': {
    title: 'Tenant Protection',
    apiType: 'rent-roll',
    columns: [
      { key: 'unit', label: 'Unit' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'monthlyRate', label: 'Monthly Rate', format: 'money', align: 'right' },
      { key: 'startDate', label: 'Start Date', format: 'date' },
    ],
  },
  'tenant-protection-revenue': {
    title: 'Tenant Protection - Revenue',
    apiType: 'revenues',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'amount', label: 'Amount', format: 'money', align: 'right' },
      { key: 'type', label: 'Type' },
    ],
  },
  'declined-tenant-protection': {
    title: 'Declined Tenant Protection',
    apiType: 'tenant-data',
    columns: [
      { key: 'name', label: 'Tenant' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
    ],
  },
  'unit-notes': {
    title: 'Unit Notes',
    apiType: 'customer-notes',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Related To' },
      { key: 'content', label: 'Note' },
      { key: 'createdBy', label: 'By' },
    ],
  },
  tasks: {
    title: 'Tasks',
    apiType: 'customer-notes',
    showDateFilter: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'tenant', label: 'Related To' },
      { key: 'content', label: 'Description' },
      { key: 'createdBy', label: 'Assigned To' },
    ],
  },
  'custom-fields': {
    title: 'Custom Fields',
    apiType: 'tenant-data',
    columns: [
      { key: 'name', label: 'Tenant' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Created', format: 'date' },
    ],
  },
  'self-insured-rentals': {
    title: 'Self Insured Rentals',
    apiType: 'rent-roll',
    columns: [
      { key: 'unit', label: 'Unit' },
      { key: 'size', label: 'Size' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'monthlyRate', label: 'Monthly Rate', format: 'money', align: 'right' },
      { key: 'startDate', label: 'Start Date', format: 'date' },
    ],
  },
}

// ── Formatters ──────────────────────────────────────────────────────────────

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

const fmtDate = (val: string | Date | null) => {
  if (!val) return '—'
  const d = new Date(val)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCell(val: unknown, format?: string): string {
  if (val === null || val === undefined) return '—'
  if (format === 'money' && typeof val === 'number') return fmtMoney(val)
  if (format === 'date') return fmtDate(val as string)
  if (format === 'percent' && typeof val === 'number') return `${val}%`
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}

// Status chip color helper
function statusColor(status: string): 'success' | 'warning' | 'error' | 'default' | 'info' {
  switch (status) {
    case 'active': case 'completed': case 'available': case 'occupied': return 'success'
    case 'pending': case 'reserved': return 'warning'
    case 'locked_out': case 'overdue': case 'maintenance': return 'error'
    default: return 'default'
  }
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ReportViewPage() {
  const params = useParams()
  const router = useRouter()
  const type = params.type as string

  const config = CONFIGS[type]

  const [rows, setRows] = useState<any[]>([])
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Date filters
  const today = new Date()
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr = today.toISOString().slice(0, 10)
  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(todayStr)

  const loadReport = useCallback(async () => {
    if (!config) return
    setLoading(true); setError(null)
    try {
      let url = `/api/reports?type=${config.apiType}`
      if (config.showDateFilter) {
        url += `&from=${fromDate}&to=${toDate}`
      }
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to load report')
      setRows(json.data.rows || [])
      setSummary(json.data.summary || {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }, [config, fromDate, toDate])

  useEffect(() => { loadReport() }, [loadReport])

  if (!config) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ color: 'text.secondary' }}>Report not found</Typography>
        <Button onClick={() => router.push('/admin/reports')} sx={{ mt: 2 }}>Back to Reports</Button>
      </Box>
    )
  }

  async function handleExportPdf() {
    if (!config) return
    setExporting(true)
    try {
      const res = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: config.title,
          columns: config.columns,
          rows,
          summary,
        }),
      })
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF export failed')
    } finally { setExporting(false) }
  }

  // Summary format helper
  const fmtSummary = (key: string, val: unknown) => {
    if (typeof val === 'number' && (key.toLowerCase().includes('total') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('rent') || key.toLowerCase().includes('credit'))) {
      return fmtMoney(val)
    }
    return String(val)
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <IconButton aria-label="Back to reports" onClick={() => router.push('/admin/reports')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: '#B8914A', fontFamily: '"Playfair Display", serif', flex: 1 }}
        >
          {config.title}
        </Typography>
        <Button
          variant="contained"
          disableElevation
          startIcon={<PictureAsPdfIcon />}
          onClick={handleExportPdf}
          disabled={exporting || rows.length === 0}
          sx={{ bgcolor: '#1C0F06', '&:hover': { bgcolor: '#3D2B1F' } }}
        >
          {exporting ? 'Generating...' : 'Export PDF'}
        </Button>
      </Box>

      {/* Date filters */}
      {config.showDateFilter && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, ml: 7 }}>
          <FilterListIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <TextField
            label="From" type="date" size="small" value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 170 }}
          />
          <TextField
            label="To" type="date" size="small" value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 170 }}
          />
          <Button variant="outlined" size="small" onClick={loadReport} sx={{ textTransform: 'none' }}>
            Apply
          </Button>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary chips */}
      {Object.keys(summary).length > 0 && !loading && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2, ml: 7 }}>
          {Object.entries(summary).map(([k, v]) => {
            const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
            return (
              <Chip
                key={k}
                label={`${label}: ${fmtSummary(k, v)}`}
                sx={{ fontWeight: 600, bgcolor: '#F5F0E8', color: '#1C0F06' }}
              />
            )
          })}
        </Box>
      )}

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>No data for this report</Typography>
        </Box>
      ) : (
        <Card sx={{ border: '1px solid #EDE5D8', boxShadow: 'none' }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {config.columns.map((col) => (
                    <TableCell
                      key={col.key}
                      align={col.align || 'left'}
                      sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', bgcolor: '#F5F0E8', borderColor: '#EDE5D8' }}
                    >
                      {col.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i} sx={{ '&:hover': { bgcolor: '#FAF7F2' }, '& td': { borderColor: '#EDE5D8' } }}>
                    {config.columns.map((col) => {
                      const val = row[col.key]
                      const isStatus = col.key === 'status' && typeof val === 'string'
                      return (
                        <TableCell key={col.key} align={col.align || 'left'}>
                          {isStatus ? (
                            <Chip
                              label={val.replace(/_/g, ' ')}
                              size="small"
                              color={statusColor(val)}
                              sx={{ textTransform: 'capitalize', fontWeight: 500, fontSize: '0.75rem' }}
                            />
                          ) : (
                            <Typography variant="body2" sx={{ fontWeight: col.key === 'tenant' || col.key === 'name' ? 500 : 400 }}>
                              {formatCell(val, col.format)}
                            </Typography>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Row count footer */}
          <Box sx={{ px: 2, py: 1, borderTop: '1px solid #EDE5D8', bgcolor: '#FDFBF7' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {rows.length} record{rows.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Card>
      )}
    </Box>
  )
}
