import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Payment from '@/models/Payment'
import Settings from '@/models/Settings'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'
import PDFDocument from 'pdfkit'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const payment = await Payment.findById(params.id)
      .populate('tenantId', 'firstName lastName email phone address city state zip')
      .populate('unitId', 'unitNumber size')
      .lean() as any

    if (!payment) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 })

    // Auth check: admin or owning tenant
    if (session.user.role !== 'admin' && session.user.id !== payment.tenantId?._id?.toString()) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const settings = await Settings.findOne({}).lean() as any
    const facilityName = settings?.facilityName ?? DEFAULT_SETTINGS.facilityName
    const facilityAddress = settings?.facilityAddress ?? DEFAULT_SETTINGS.facilityAddress
    const facilityCity = settings?.facilityCity ?? DEFAULT_SETTINGS.facilityCity
    const facilityState = settings?.facilityState ?? DEFAULT_SETTINGS.facilityState
    const facilityZip = settings?.facilityZip ?? DEFAULT_SETTINGS.facilityZip
    const facilityPhone = settings?.facilityPhone ?? DEFAULT_SETTINGS.facilityPhone

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    const accent = '#C17B4A'
    const dark = '#1C0F06'

    // Header
    doc.rect(0, 0, doc.page.width, 70).fill(dark)
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text(facilityName, 50, 22)
    doc.fontSize(9).font('Helvetica')
      .text(`${facilityAddress}, ${facilityCity}, ${facilityState} ${facilityZip} | ${facilityPhone}`, 50, 46)

    // Receipt title
    let y = 90
    doc.fillColor(accent).fontSize(18).font('Helvetica-Bold').text('Payment Receipt', 50, y)
    y += 30

    // Receipt details
    doc.fontSize(10).font('Helvetica').fillColor('#666')
    doc.text('Receipt #:', 50, y).fillColor(dark).text(payment._id.toString(), 150, y)
    y += 16
    doc.fillColor('#666').text('Date:', 50, y).fillColor(dark).text(new Date(payment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 150, y)
    y += 16
    doc.fillColor('#666').text('Status:', 50, y).fillColor(payment.status === 'succeeded' ? '#16A34A' : '#DC2626').text(payment.status.toUpperCase(), 150, y)
    y += 30

    // Tenant info
    doc.fillColor(dark).fontSize(12).font('Helvetica-Bold').text('Billed To:', 50, y)
    y += 18
    doc.fontSize(10).font('Helvetica').fillColor(dark)
    const tenant = payment.tenantId
    if (tenant) {
      doc.text(`${tenant.firstName} ${tenant.lastName}`, 50, y); y += 14
      if (tenant.email) { doc.text(tenant.email, 50, y); y += 14 }
      if (tenant.phone) { doc.text(tenant.phone, 50, y); y += 14 }
      if (tenant.address) { doc.text(`${tenant.address}, ${tenant.city ?? ''} ${tenant.state ?? ''} ${tenant.zip ?? ''}`, 50, y); y += 14 }
    }
    y += 10

    // Unit info
    const unit = payment.unitId
    if (unit) {
      doc.fillColor('#666').text(`Unit: ${unit.unitNumber} (${unit.size})`, 50, y)
      y += 20
    }

    // Line items table
    const tableX = 50
    const tableW = doc.page.width - 100
    doc.rect(tableX, y, tableW, 24).fill('#F5F0E8')
    doc.fillColor(dark).fontSize(9).font('Helvetica-Bold')
    doc.text('Description', tableX + 10, y + 7)
    doc.text('Period', tableX + 250, y + 7)
    doc.text('Amount', tableX + tableW - 80, y + 7, { width: 70, align: 'right' })
    y += 24

    // Payment type labels
    const typeLabels: Record<string, string> = {
      rent: 'Monthly Rent', late_fee: 'Late Fee', deposit: 'Security Deposit',
      prorated: 'Prorated Rent', other: 'Other Charge',
    }

    doc.font('Helvetica').fontSize(10).fillColor(dark)
    doc.text(typeLabels[payment.type] ?? payment.type, tableX + 10, y + 6)
    const periodStr = `${new Date(payment.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(payment.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    doc.text(periodStr, tableX + 250, y + 6)
    doc.text(`$${(payment.amount / 100).toFixed(2)}`, tableX + tableW - 80, y + 6, { width: 70, align: 'right' })
    y += 24

    // Total
    doc.moveTo(tableX, y).lineTo(tableX + tableW, y).lineWidth(1).strokeColor('#EDE5D8').stroke()
    y += 8
    doc.fontSize(12).font('Helvetica-Bold').fillColor(dark)
    doc.text('Total', tableX + 10, y)
    doc.text(`$${(payment.amount / 100).toFixed(2)}`, tableX + tableW - 80, y, { width: 70, align: 'right' })
    y += 30

    // Payment method
    if (payment.stripePaymentIntentId && !payment.stripePaymentIntentId.startsWith('pi_mock')) {
      doc.fontSize(9).fillColor('#666').font('Helvetica')
      doc.text(`Payment ID: ${payment.stripePaymentIntentId}`, 50, y)
      y += 14
    }

    // Footer
    doc.fontSize(8).fillColor('#999')
      .text('Thank you for your business!', 50, doc.page.height - 60, { width: tableW, align: 'center' })
      .text(`${facilityName} | ${facilityAddress}, ${facilityCity}, ${facilityState} ${facilityZip}`, 50, doc.page.height - 45, { width: tableW, align: 'center' })

    doc.end()

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="receipt-${payment._id}.pdf"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
