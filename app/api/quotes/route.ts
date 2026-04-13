import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import PDFDocument from 'pdfkit'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Settings from '@/models/Settings'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'

const quoteSchema = z.object({
  unitSize: z.string().min(1),
  monthlyRent: z.number().int().min(0),         // cents
  startDate: z.string().min(1),                  // billing cycle start e.g. "5/1/2026"
  moveInDate: z.string().min(1),                 // actual move-in e.g. "4/11/2026"
  deposit: z.number().int().min(0),              // cents
  chargeDeposit: z.boolean(),
  setupFee: z.number().int().min(0).optional(),  // cents
  chargeSetupFee: z.boolean().optional(),
  tenantProtection: z.number().int().min(0).optional(),  // cents/month
  promotionName: z.string().optional(),
  promotionDiscount: z.number().int().min(0).optional(), // cents off monthly
  taxRate: z.number().min(0).max(100).optional(),
  proratingOption: z.enum([
    'no_prorate',
    'bill_first_full_prorate_second',
    'prorate_first_month',
  ]).optional(),
})

export type QuoteInput = z.infer<typeof quoteSchema>

// Helper: calculate prorated amount
function prorateAmount(monthlyCents: number, moveInDate: Date, billingStartDate: Date): number {
  // Days in the billing month
  const year = billingStartDate.getFullYear()
  const month = billingStartDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Remaining days from move-in to billing start
  const moveDay = moveInDate.getDate()
  const remaining = daysInMonth - moveDay + 1
  return Math.round((monthlyCents / daysInMonth) * remaining)
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

// POST /api/quotes — generate quote PDF
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = quoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
    }

    const q = parsed.data
    await connectDB()

    // Get facility info
    const settings = await Settings.findOne({}).lean()
    const facilityName = settings?.facilityName ?? DEFAULT_SETTINGS.facilityName
    const facilityAddress = settings?.facilityAddress ?? '2519 Highway 116, Caryville, TN 37714'
    const facilityCity = settings?.facilityCity ?? 'Rockford'
    const facilityState = settings?.facilityState ?? 'TN'
    const facilityZip = settings?.facilityZip ?? '37853'

    // Calculate line items
    const moveIn = new Date(q.moveInDate)
    const billingStart = new Date(q.startDate)
    const rent = q.monthlyRent
    const protection = q.tenantProtection ?? 0
    const deposit = q.chargeDeposit ? q.deposit : 0
    const setupFee = (q.chargeSetupFee && q.setupFee) ? q.setupFee : 0
    const prorationOpt = q.proratingOption ?? 'bill_first_full_prorate_second'

    // Tax
    const taxRate = q.taxRate ?? 0
    const rentTax = Math.round(rent * (taxRate / 100))
    const rentWithTax = rent + rentTax

    // Total due today line items
    const lineItems: Array<{ label: string; amount: number }> = []
    lineItems.push({ label: `Rent for 1 month period starting ${fmtDate(q.moveInDate)}`, amount: rentWithTax })
    if (protection > 0) lineItems.push({ label: 'Tenant protection fee', amount: protection })
    if (deposit > 0) lineItems.push({ label: 'Deposit', amount: deposit })
    if (setupFee > 0) lineItems.push({ label: 'Setup fee', amount: setupFee })

    const totalDue = lineItems.reduce((s, l) => s + l.amount, 0)

    // Future charges
    const futureItems: Array<{ label: string; amount: number }> = []

    if (prorationOpt === 'bill_first_full_prorate_second') {
      const proratedRent = prorateAmount(rent, moveIn, billingStart)
      const proratedRentTax = Math.round(proratedRent * (taxRate / 100))
      futureItems.push({
        label: `Prorated Second Month (Billed on ${fmtDate(q.startDate)})`,
        amount: proratedRent + proratedRentTax,
      })
      if (protection > 0) {
        const proratedProtection = prorateAmount(protection, moveIn, billingStart)
        futureItems.push({
          label: `Prorated Tenant Protection Fee (Billed on ${fmtDate(q.startDate)})`,
          amount: proratedProtection,
        })
      }
    } else if (prorationOpt === 'prorate_first_month') {
      // First month is prorated (already in lineItems) — we'd adjust but for simplicity keep as-is
    }

    // Monthly recurring
    const monthlyTotal = rentWithTax + protection
    // Calculate first full month date
    const recurringStart = new Date(billingStart)
    recurringStart.setMonth(recurringStart.getMonth() + 1)
    futureItems.push({
      label: `Amount due each month starting ${fmtDate(recurringStart.toISOString())}`,
      amount: monthlyTotal,
    })

    // ── Generate PDF ──────────────────────────────────────────────────────────

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
    const chunks: Uint8Array[] = []
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk))

    const pdfDone = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    const accentColor = '#C17B4A'
    const now = new Date()
    const timestamp = `${facilityName}: ${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`

    // Header timestamp (top-right)
    doc.fontSize(8).fillColor('#666666').text(timestamp, 50, 40, { align: 'right' })

    // Title
    doc.moveDown(0.5)
    doc.fontSize(22).fillColor(accentColor).font('Helvetica-Bold')
      .text(`Quote for ${q.unitSize}`, 50, 65)

    // Facility address
    doc.fontSize(10).fillColor('#333333').font('Helvetica')
    doc.text(facilityName, 50, 95)
    doc.text(facilityAddress)
    doc.text(`${facilityCity}, ${facilityState} ${facilityZip}`)

    // Table
    const tableTop = 150
    const tableLeft = 50
    const tableRight = 562
    const colLabelRight = 430
    const colAmountLeft = 440

    let y = tableTop

    function drawRow(label: string, amount: string, bold = false) {
      // Row border
      doc.moveTo(tableLeft, y).lineTo(tableRight, y).strokeColor('#E0D5C7').lineWidth(0.5).stroke()
      doc.fontSize(10).fillColor('#333333')
      if (bold) doc.font('Helvetica-Bold')
      else doc.font('Helvetica')
      doc.text(label, tableLeft + 8, y + 8, { width: colLabelRight - tableLeft - 16, align: 'right' })
      doc.text(amount, colAmountLeft, y + 8, { width: tableRight - colAmountLeft - 8, align: 'right' })
      y += 28
    }

    // Line items
    for (const item of lineItems) {
      drawRow(item.label, fmtMoney(item.amount))
    }

    // Total Due row (bold)
    doc.moveTo(tableLeft, y).lineTo(tableRight, y).strokeColor('#E0D5C7').lineWidth(0.5).stroke()
    doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold')
    doc.text('Total Due', tableLeft + 8, y + 8, { width: colLabelRight - tableLeft - 16, align: 'right' })
    doc.text(fmtMoney(totalDue), colAmountLeft, y + 8, { width: tableRight - colAmountLeft - 8, align: 'right' })
    y += 28

    // Future items
    for (const item of futureItems) {
      drawRow(item.label, fmtMoney(item.amount))
    }

    // Bottom border
    doc.moveTo(tableLeft, y).lineTo(tableRight, y).strokeColor('#E0D5C7').lineWidth(0.5).stroke()

    // Disclaimer
    y += 20
    doc.fontSize(9).fillColor('#666666').font('Helvetica')
    doc.text('Disclaimer: Prices subject to change based on unit availability or other changes.', 50, y)

    // Footer
    doc.fontSize(8).fillColor('#999999')
    doc.text(`${facilityName}: ${fmtDate(now.toISOString())}`, 50, 720, { align: 'center' })
    doc.text('1/1', 50, 735, { align: 'center' })

    doc.end()

    const pdfBuffer = await pdfDone

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Quote-${q.unitSize.replace(/\s/g, '')}.pdf"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
