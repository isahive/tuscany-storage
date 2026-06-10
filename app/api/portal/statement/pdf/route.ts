import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Payment from '@/models/Payment'
import Settings from '@/models/Settings'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'
import PDFDocument from 'pdfkit'

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  rent: 'Monthly Rent',
  late_fee: 'Past Due Fee',
  deposit: 'Security Deposit',
  prorated: 'Prorated Rent',
  other: 'Fee',
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

/**
 * GET /api/portal/statement/pdf
 *
 * Generates a downloadable invoice PDF for the tenant's current statement —
 * matches the live `Invoice.pdf` Storable produces (header bar + Bill To +
 * line items table + total). Used by the Download button on the Statement
 * screen.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    void Unit // ensure Unit is registered for populate

    const [tenant, settings, items, leases] = await Promise.all([
      Tenant.findById(session.user.id).lean() as any,
      Settings.findOne({}).lean() as any,
      Payment.find({
        tenantId: session.user.id,
        status: 'pending',
        direction: 'charge',
      }).populate('unitId', 'unitNumber').sort({ createdAt: 1 }).lean() as any,
      Lease.find({ tenantId: session.user.id, status: { $in: ['active', 'pending_moveout'] } }).lean() as any,
    ])

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const facilityName = settings?.facilityName ?? DEFAULT_SETTINGS.facilityName
    const facilityAddress = settings?.facilityAddress ?? DEFAULT_SETTINGS.facilityAddress
    const facilityCity = settings?.facilityCity ?? DEFAULT_SETTINGS.facilityCity
    const facilityState = settings?.facilityState ?? DEFAULT_SETTINGS.facilityState
    const facilityZip = settings?.facilityZip ?? DEFAULT_SETTINGS.facilityZip
    const facilityPhone = settings?.facilityPhone ?? DEFAULT_SETTINGS.facilityPhone

    const subtotal = items.reduce((sum: number, p: any) => sum + p.amount, 0)
    const tax = items.reduce((sum: number, p: any) => sum + Math.round(p.amount * ((p.taxRate ?? 0) / 100)), 0)
    const balance = tenant.balance ?? 0
    const credit = balance < 0 ? -balance : 0
    const total = Math.max(0, subtotal + tax - credit)

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    const olive = '#8CA87C'
    const dark = '#1C0F06'

    // Header strip
    doc.rect(0, 0, doc.page.width, 70).fill(dark)
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text(facilityName, 50, 22)
    doc.fontSize(9).font('Helvetica')
      .text(`${facilityAddress}, ${facilityCity}, ${facilityState} ${facilityZip} | ${facilityPhone}`, 50, 46)

    // Title
    let y = 92
    doc.fillColor(olive).fontSize(20).font('Helvetica-Bold').text('Invoice', 50, y)

    // Invoice meta
    doc.fillColor('#666').fontSize(10).font('Helvetica')
      .text(`Invoice Date: ${fmtDate(new Date())}`, doc.page.width - 220, y + 4)
    doc.text(`Invoice #: ${session.user.id.slice(-8).toUpperCase()}`, doc.page.width - 220, y + 18)
    y += 50

    // Bill To
    doc.fillColor(dark).fontSize(11).font('Helvetica-Bold').text('Bill To:', 50, y); y += 16
    doc.font('Helvetica').fontSize(10)
    doc.text(`${tenant.firstName} ${tenant.lastName}`, 50, y); y += 13
    if (tenant.email) { doc.text(tenant.email, 50, y); y += 13 }
    if (tenant.phone) { doc.text(tenant.phone, 50, y); y += 13 }
    if (tenant.address) {
      doc.text(`${tenant.address}`, 50, y); y += 13
      if (tenant.addressLine2) { doc.text(`${tenant.addressLine2}`, 50, y); y += 13 }
      doc.text(`${tenant.city ?? ''}, ${tenant.state ?? ''} ${tenant.zip ?? ''}`.trim(), 50, y); y += 13
    }
    y += 12

    // Line items header
    const tableX = 50
    const tableW = doc.page.width - 100
    const colDate = tableX + 8
    const colDesc = tableX + 90
    const colAmt = tableX + tableW - 200
    const colTax = tableX + tableW - 120
    const colDue = tableX + tableW - 60

    doc.rect(tableX, y, tableW, 22).fill('#F5F0E8')
    doc.fillColor(dark).fontSize(10).font('Helvetica-Bold')
    doc.text('Date', colDate, y + 6)
    doc.text('Description', colDesc, y + 6)
    doc.text('Amount', colAmt, y + 6, { width: 60, align: 'right' })
    doc.text('Tax', colTax, y + 6, { width: 50, align: 'right' })
    doc.text('Due', colDue, y + 6, { width: 60, align: 'right' })
    y += 26

    doc.font('Helvetica').fontSize(9).fillColor(dark)
    for (const it of items) {
      const itemTax = Math.round(it.amount * ((it.taxRate ?? 0) / 100))
      const due = it.amount + itemTax
      const label = PAYMENT_TYPE_LABEL[it.type] ?? it.type
      const unitNum = it.unitId?.unitNumber ? `unit ${it.unitId.unitNumber}` : ''
      const descLine = it.description?.trim()
        ? it.description
        : `${label}${unitNum ? ` — ${unitNum}` : ''}`

      doc.text(fmtDate(new Date(it.createdAt)), colDate, y, { width: 75 })
      doc.text(descLine, colDesc, y, { width: colAmt - colDesc - 5 })
      doc.text(`$${(it.amount / 100).toFixed(2)}`, colAmt, y, { width: 60, align: 'right' })
      doc.text(`$${(itemTax / 100).toFixed(2)}`, colTax, y, { width: 50, align: 'right' })
      doc.text(`$${(due / 100).toFixed(2)}`, colDue, y, { width: 60, align: 'right' })
      y += 24

      if (y > doc.page.height - 120) {
        doc.addPage()
        y = 60
      }
    }

    // Totals
    doc.moveTo(tableX, y).lineTo(tableX + tableW, y).strokeColor('#EDE5D8').lineWidth(1).stroke()
    y += 10

    doc.fontSize(10).fillColor('#666').font('Helvetica')
    doc.text('Subtotal:', colTax - 30, y, { width: 80, align: 'right' })
    doc.fillColor(dark).text(`$${(subtotal / 100).toFixed(2)}`, colDue, y, { width: 60, align: 'right' })
    y += 14

    if (tax > 0) {
      doc.fillColor('#666').text('Tax:', colTax - 30, y, { width: 80, align: 'right' })
      doc.fillColor(dark).text(`$${(tax / 100).toFixed(2)}`, colDue, y, { width: 60, align: 'right' })
      y += 14
    }

    if (credit > 0) {
      doc.fillColor('#666').text('Credit:', colTax - 30, y, { width: 80, align: 'right' })
      doc.fillColor(dark).text(`-$${(credit / 100).toFixed(2)}`, colDue, y, { width: 60, align: 'right' })
      y += 14
    }

    y += 4
    doc.fontSize(12).fillColor(dark).font('Helvetica-Bold')
    doc.text('Total:', colTax - 30, y, { width: 80, align: 'right' })
    doc.text(`$${(total / 100).toFixed(2)}`, colDue, y, { width: 60, align: 'right' })

    // Footer
    doc.fontSize(8).fillColor('#999').font('Helvetica')
      .text('Thank you for being a Tuscany Village customer.', 50, doc.page.height - 60, { width: tableW, align: 'center' })
      .text(`${facilityName} | ${facilityAddress}, ${facilityCity}, ${facilityState} ${facilityZip}`, 50, doc.page.height - 45, { width: tableW, align: 'center' })

    doc.end()

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${session.user.id.slice(-8)}.pdf"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
