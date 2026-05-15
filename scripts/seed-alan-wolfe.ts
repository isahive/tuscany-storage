/**
 * Seed Alan Wolfe's full billing history from the Storable live admin (Unit C2).
 *
 * Idempotent: wipes all existing Payment rows for this tenant and inserts the
 * 110 transactions/line-items pulled from the screenshot Silvio shared.
 *
 * Run:  npm run seed:alan-wolfe
 */
import mongoose, { Types } from 'mongoose'
import { balanceDelta } from '../lib/paymentBalance'

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuscany-storage'
const TENANT_EMAIL = 'woofee63@gmail.com'

type Row = {
  /** Date label as M/D/YYYY (US) — converted to a Date at insert time */
  date: string
  /** Original Storable invoice/transaction id, kept for traceability */
  storableId: string
  /** rent | late_fee | other | credit */
  type: 'rent' | 'late_fee' | 'deposit' | 'prorated' | 'credit' | 'other'
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'voided'
  direction: 'charge' | 'payment'
  /** Amount in cents */
  amount: number
  /** Description shown in billing history */
  description: string
}

function parseUSDate(s: string): Date {
  const [m, d, y] = s.split('/').map(Number)
  // 12:00 UTC keeps the date stable regardless of timezone display.
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

const ROWS: Row[] = [
  // ── 2022 ───────────────────────────────────────────────────────────────
  { date: '6/24/2022', storableId: '54233195', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 7/1/2022' },
  { date: '7/2/2022',  storableId: '54781481', type: 'rent', status: 'succeeded', direction: 'charge', amount: 7500, description: 'Unit C2 rent for 1 month period starting 6/1/2022' },
  { date: '7/5/2022',  storableId: '54822211', type: 'late_fee', status: 'voided', direction: 'charge', amount: 2000, description: 'Past Due Fee for unit C2 rent due on 7/1/2022' },
  { date: '7/5/2022',  storableId: '39052208', type: 'other', status: 'voided', direction: 'payment', amount: 2000, description: 'Canceled $20.00 of Past Due Fee for unit C2 rent due on 7/1/2022' },
  { date: '7/7/2022',  storableId: '54892481', type: 'late_fee', status: 'succeeded', direction: 'charge', amount: 2000, description: 'Past Due Fee for unit C2 rent due on 7/2/2022' },
  { date: '7/13/2022', storableId: '39260184', type: 'rent', status: 'succeeded', direction: 'payment', amount: 18000, description: 'Master ending in 0569 — Paid $85.00 of Unit C2 rent for 1 month period starting 7/1/2022; Paid $75.00 of Unit C2 rent for 1 month period starting 6/1/2022; Paid $20.00 of Past Due Fee for unit C2 rent due on 7/2/2022' },
  { date: '7/25/2022', storableId: '55480156', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 8/1/2022' },
  { date: '8/6/2022',  storableId: '56344139', type: 'late_fee', status: 'succeeded', direction: 'charge', amount: 2000, description: 'Past Due Fee for unit C2 rent due on 8/1/2022' },
  { date: '8/25/2022', storableId: '57144423', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 9/1/2022' },
  { date: '9/6/2022',  storableId: '57801847', type: 'late_fee', status: 'succeeded', direction: 'charge', amount: 2000, description: 'Past Due Fee for unit C2 rent due on 9/1/2022' },
  { date: '9/8/2022',  storableId: '41322942', type: 'rent', status: 'succeeded', direction: 'payment', amount: 10000, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 8/1/2022; Paid $15.00 of Past Due Fee for unit C2 rent due on 8/1/2022' },
  { date: '9/22/2022', storableId: '41557591', type: 'rent', status: 'succeeded', direction: 'payment', amount: 11000, description: 'Visa ending in 7352 — Paid $5.00 of Past Due Fee for unit C2 rent due on 8/1/2022; Paid $85.00 of Unit C2 rent for 1 month period starting 9/1/2022; Paid $20.00 of Past Due Fee for unit C2 rent due on 9/1/2022' },
  { date: '9/24/2022', storableId: '58436803', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 10/1/2022' },
  { date: '10/6/2022', storableId: '59264841', type: 'late_fee', status: 'succeeded', direction: 'charge', amount: 2000, description: 'Past Due Fee for unit C2 rent due on 10/1/2022' },
  { date: '10/10/2022', storableId: '42451483', type: 'rent', status: 'succeeded', direction: 'payment', amount: 10500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 10/1/2022; Paid $20.00 of Past Due Fee for unit C2 rent due on 10/1/2022' },
  { date: '10/25/2022', storableId: '59851603', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 11/1/2022' },
  { date: '11/4/2022', storableId: '43408859', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Master ending in 2794 — Paid $85.00 of Unit C2 rent for 1 month period starting 11/1/2022' },
  { date: '11/24/2022', storableId: '61311699', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 12/1/2022' },
  { date: '12/5/2022', storableId: '44500574', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 12/1/2022' },
  { date: '12/25/2022', storableId: '62812018', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 1/1/2023' },

  // ── 2023 ───────────────────────────────────────────────────────────────
  { date: '1/4/2023',  storableId: '45543384', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 1/1/2023' },
  { date: '1/25/2023', storableId: '64332047', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 2/1/2023' },
  { date: '2/4/2023',  storableId: '46649447', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 2/1/2023' },
  { date: '2/22/2023', storableId: '65712148', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 3/1/2023' },
  { date: '3/5/2023',  storableId: '47761012', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 3/1/2023' },
  { date: '3/25/2023', storableId: '67299431', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 4/1/2023' },
  { date: '4/4/2023',  storableId: '48867852', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Master ending in 2794 — Paid $85.00 of Unit C2 rent for 1 month period starting 4/1/2023' },
  { date: '4/24/2023', storableId: '68768778', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 5/1/2023' },
  { date: '5/4/2023',  storableId: '50010277', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 5/1/2023' },
  { date: '5/25/2023', storableId: '70421836', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 6/1/2023' },
  { date: '6/2/2023',  storableId: '51080350', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 6/1/2023' },
  { date: '6/24/2023', storableId: '71945048', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 7/1/2023' },
  { date: '7/4/2023',  storableId: '52294101', type: 'rent', status: 'failed', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Transaction declined: Expired Card' },
  { date: '7/4/2023',  storableId: '52294144', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 7/1/2023' },
  { date: '7/25/2023', storableId: '73623766', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 8/1/2023' },
  { date: '8/4/2023',  storableId: '53525032', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Master ending in 2794 — Paid $85.00 of Unit C2 rent for 1 month period starting 8/1/2023' },
  { date: '8/25/2023', storableId: '75283760', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 9/1/2023' },
  { date: '9/3/2023',  storableId: '54648044', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6765 — Paid $85.00 of Unit C2 rent for 1 month period starting 9/1/2023' },
  { date: '9/24/2023', storableId: '76886380', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 10/1/2023' },
  { date: '10/4/2023', storableId: '55885850', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 10/1/2023' },
  { date: '10/25/2023', storableId: '78544934', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 11/1/2023' },
  { date: '11/4/2023', storableId: '57105469', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 9383 — Paid $85.00 of Unit C2 rent for 1 month period starting 11/1/2023' },
  { date: '11/24/2023', storableId: '80182169', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 12/1/2023' },
  { date: '12/4/2023', storableId: '58258361', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6765 — Paid $85.00 of Unit C2 rent for 1 month period starting 12/1/2023' },
  { date: '12/25/2023', storableId: '81946103', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 1/1/2024' },

  // ── 2024 ───────────────────────────────────────────────────────────────
  { date: '1/5/2024',  storableId: '59510790', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 1/1/2024' },
  { date: '1/25/2024', storableId: '83557467', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 2/1/2024' },
  { date: '2/4/2024',  storableId: '60680376', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 2/1/2024' },
  { date: '2/23/2024', storableId: '85179338', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 3/1/2024' },
  { date: '3/4/2024',  storableId: '61889692', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 3/1/2024' },
  { date: '3/25/2024', storableId: '86821306', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 4/1/2024' },
  { date: '4/5/2024',  storableId: '63161606', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Master ending in 4251 — Paid $85.00 of Unit C2 rent for 1 month period starting 4/1/2024' },
  { date: '4/24/2024', storableId: '88619736', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 5/1/2024' },
  { date: '5/5/2024',  storableId: '64395774', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 5/1/2024' },
  { date: '5/25/2024', storableId: '90394594', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 6/1/2024' },
  { date: '6/5/2024',  storableId: '65661333', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6765 — Paid $85.00 of Unit C2 rent for 1 month period starting 6/1/2024' },
  { date: '6/24/2024', storableId: '92013628', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 7/1/2024' },
  { date: '7/6/2024',  storableId: '93151539', type: 'late_fee', status: 'succeeded', direction: 'charge', amount: 2000, description: 'Past Due Fee for unit C2 rent due on 7/1/2024' },
  { date: '7/25/2024', storableId: '93801163', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 8/1/2024' },
  { date: '8/6/2024',  storableId: '94928797', type: 'late_fee', status: 'succeeded', direction: 'charge', amount: 2000, description: 'Past Due Fee for unit C2 rent due on 8/1/2024' },
  { date: '8/7/2024',  storableId: '94985119', type: 'other', status: 'voided', direction: 'charge', amount: 2000, description: 'Cut Lock Fee for unit C2 rent due on 7/1/2024' },
  { date: '8/7/2024',  storableId: '94985254', type: 'other', status: 'succeeded', direction: 'charge', amount: 2500, description: 'Advertisement Fee for unit C2 rent due on 7/1/2024' },
  { date: '8/25/2024', storableId: '95711619', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 9/1/2024' },
  { date: '8/30/2024', storableId: '68744408', type: 'rent', status: 'succeeded', direction: 'payment', amount: 32000, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 7/1/2024; Paid $20.00 of Past Due Fee for unit C2 rent due on 7/1/2024; Paid $85.00 of Unit C2 rent for 1 month period starting 8/1/2024; Paid $20.00 of Past Due Fee for unit C2 rent due on 8/1/2024; Paid $25.00 of Advertisement Fee for unit C2 rent due on 7/1/2024; Paid $85.00 of Unit C2 rent for 1 month period starting 9/1/2024' },
  { date: '9/3/2024',  storableId: '269931',   type: 'other', status: 'refunded', direction: 'payment', amount: 2000, description: 'Credit Card payment — Credit to account - lock not cut' },
  { date: '9/5/2024',  storableId: '69482782', type: 'other', status: 'voided', direction: 'payment', amount: 2000, description: 'Canceled $20.00 of Cut Lock Fee for unit C2 rent due on 7/1/2024' },
  { date: '9/5/2024',  storableId: '69482792', type: 'credit', status: 'succeeded', direction: 'payment', amount: 2000, description: 'Added $20.00 credit — Cut Lock fee refund' },
  { date: '9/24/2024', storableId: '97396604', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 10/1/2024' },
  // Storable's 10/1/2024 "credit applied" row is intentionally omitted — it's
  // a bookkeeping note (the $20 credit added on 9/5 paying part of October
  // rent) that does NOT move the balance in Storable's display. Including
  // it would double-count the credit.
  { date: '10/5/2024', storableId: '70743760', type: 'rent', status: 'succeeded', direction: 'payment', amount: 6500, description: 'Visa ending in 6078 — Paid $65.00 of Unit C2 rent for 1 month period starting 10/1/2024' },
  { date: '10/25/2024', storableId: '99190269', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 11/1/2024' },
  { date: '11/4/2024', storableId: '71983935', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 11/1/2024' },
  { date: '11/24/2024', storableId: '100962459', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 12/1/2024' },
  { date: '12/4/2024', storableId: '73231146', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 12/1/2024' },
  { date: '12/25/2024', storableId: '102664864', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 1/1/2025' },

  // ── 2025 ───────────────────────────────────────────────────────────────
  { date: '1/5/2025',  storableId: '74490458', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 1/1/2025' },
  { date: '1/25/2025', storableId: '104457932', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 2/1/2025' },
  { date: '2/5/2025',  storableId: '75742788', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 2/1/2025' },
  { date: '2/22/2025', storableId: '106263815', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 3/1/2025' },
  { date: '3/6/2025',  storableId: '107280174', type: 'late_fee', status: 'succeeded', direction: 'charge', amount: 2000, description: 'Past Due Fee for unit C2 rent due on 3/1/2025' },
  { date: '3/25/2025', storableId: '108042704', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 4/1/2025' },
  { date: '3/31/2025', storableId: '77500907', type: 'rent', status: 'succeeded', direction: 'payment', amount: 10500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 3/1/2025; Paid $20.00 of Past Due Fee for unit C2 rent due on 3/1/2025' },
  { date: '4/6/2025',  storableId: '109051148', type: 'late_fee', status: 'succeeded', direction: 'charge', amount: 2000, description: 'Past Due Fee for unit C2 rent due on 4/1/2025' },
  { date: '4/24/2025', storableId: '109687942', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 5/1/2025' },
  { date: '5/3/2025',  storableId: '79438254', type: 'rent', status: 'succeeded', direction: 'payment', amount: 10500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 4/1/2025; Paid $20.00 of Past Due Fee for unit C2 rent due on 4/1/2025' },
  { date: '5/6/2025',  storableId: '110839470', type: 'late_fee', status: 'succeeded', direction: 'charge', amount: 2000, description: 'Past Due Fee for unit C2 rent due on 5/1/2025' },
  { date: '5/25/2025', storableId: '111651616', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 6/1/2025' },
  { date: '5/31/2025', storableId: '80072474', type: 'rent', status: 'succeeded', direction: 'payment', amount: 19000, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 5/1/2025; Paid $20.00 of Past Due Fee for unit C2 rent due on 5/1/2025; Paid $85.00 of Unit C2 rent for 1 month period starting 6/1/2025' },
  { date: '6/24/2025', storableId: '113306691', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 7/1/2025' },
  { date: '6/28/2025', storableId: '81288880', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 7/1/2025' },
  { date: '7/25/2025', storableId: '115300105', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 8/1/2025' },
  { date: '7/26/2025', storableId: '82526575', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 rent for 1 month period starting 8/1/2025' },
  { date: '8/21/2025', storableId: '116783001', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 prepaid rent for 1 month period starting 9/1/2025.' },
  { date: '8/21/2025', storableId: '83727383', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 6078 — Paid $85.00 of Unit C2 prepaid rent for 1 month period starting 9/1/2025.' },
  { date: '9/24/2025', storableId: '118866547', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 10/1/2025' },
  { date: '10/3/2025', storableId: '85910783', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 9097 — Paid $85.00 of Unit C2 rent for 1 month period starting 10/1/2025' },
  { date: '10/25/2025', storableId: '120723989', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 11/1/2025' },
  { date: '11/5/2025', storableId: '87256514', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 9097 — Paid $85.00 of Unit C2 rent for 1 month period starting 11/1/2025' },
  { date: '11/24/2025', storableId: '122365560', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 12/1/2025' },
  { date: '12/3/2025', storableId: '88437877', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 9097 — Paid $85.00 of Unit C2 rent for 1 month period starting 12/1/2025' },
  { date: '12/25/2025', storableId: '124211327', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 1/1/2026' },

  // ── 2026 ───────────────────────────────────────────────────────────────
  { date: '1/3/2026',  storableId: '89706144', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 9097 — Paid $85.00 of Unit C2 rent for 1 month period starting 1/1/2026' },
  { date: '1/25/2026', storableId: '125905604', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 2/1/2026' },
  { date: '2/3/2026',  storableId: '90947176', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 9097 — Paid $85.00 of Unit C2 rent for 1 month period starting 2/1/2026' },
  { date: '2/22/2026', storableId: '127696414', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 3/1/2026' },
  { date: '3/4/2026',  storableId: '92255475', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 9097 — Paid $85.00 of Unit C2 rent for 1 month period starting 3/1/2026' },
  { date: '3/25/2026', storableId: '129393080', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 4/1/2026' },
  { date: '3/27/2026', storableId: '92730667', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 9097 — Paid $85.00 of Unit C2 rent for 1 month period starting 4/1/2026' },
  { date: '4/24/2026', storableId: '131299568', type: 'rent', status: 'succeeded', direction: 'charge', amount: 8500, description: 'Unit C2 rent for 1 month period starting 5/1/2026' },
  { date: '4/29/2026', storableId: '94070963', type: 'rent', status: 'succeeded', direction: 'payment', amount: 8500, description: 'Visa ending in 9097 — Paid $85.00 of Unit C2 rent for 1 month period starting 5/1/2026' },
]

async function main() {
  console.log('Connecting to MongoDB…')
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  console.log('Connected.')

  const tenant = await db.collection('tenants').findOne({ email: TENANT_EMAIL })
  if (!tenant) {
    console.error(`Tenant ${TENANT_EMAIL} not found`)
    process.exit(1)
  }
  console.log(`Tenant: ${tenant.firstName} ${tenant.lastName} (${tenant._id})`)

  const lease = await db.collection('leases').findOne({ tenantId: tenant._id, status: 'active' })
  if (!lease) {
    console.error('No active lease for tenant')
    process.exit(1)
  }
  console.log(`Lease: ${lease._id} — Unit ${lease.unitId} @ $${(lease.monthlyRate / 100).toFixed(2)}/mo`)

  const wipe = await db.collection('payments').deleteMany({ tenantId: tenant._id })
  console.log(`Wiped ${wipe.deletedCount} existing payment rows for this tenant.`)

  // Walk oldest→newest so each row gets the correct balanceAfter snapshot.
  let running = 0
  const docs = ROWS.map((r) => {
    const createdAt = parseUSDate(r.date)
    running += balanceDelta(r)
    return {
      tenantId: tenant._id as Types.ObjectId,
      leaseId: lease._id as Types.ObjectId,
      unitId: lease.unitId as Types.ObjectId,
      stripePaymentIntentId: `storable_${r.storableId}`,
      amount: r.amount,
      currency: 'usd',
      type: r.type,
      status: r.status,
      direction: r.direction,
      balanceAfter: running,
      attemptCount: 1,
      lastAttemptAt: createdAt,
      description: r.description,
      importSource: 'alan-wolfe-historical',
      createdAt,
      updatedAt: createdAt,
    }
  })

  const insert = await db.collection('payments').insertMany(docs)
  console.log(`Inserted ${insert.insertedCount} payment rows.`)

  // Final balance is just the last running snapshot from the loop above.
  const balance = running
  const chargesTotal = ROWS.reduce((s, r) => s + (r.direction === 'charge' ? r.amount : 0), 0)
  const paymentsTotal = ROWS.reduce(
    (s, r) => s + (r.direction === 'payment' && r.status !== 'failed' && r.status !== 'refunded' ? r.amount : 0),
    0,
  )
  console.log(`Charges total : $${(chargesTotal / 100).toFixed(2)}`)
  console.log(`Payments total: $${(paymentsTotal / 100).toFixed(2)}`)
  console.log(`Final balance : $${(balance / 100).toFixed(2)}`)

  await db.collection('tenants').updateOne(
    { _id: tenant._id },
    { $set: { balance } },
  )
  console.log('Updated tenant.balance.')

  await mongoose.disconnect()
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
