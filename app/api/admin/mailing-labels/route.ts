import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import PDFDocument from 'pdfkit'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { tenantIds } = await req.json()
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No tenants selected' }, { status: 400 })
    }

    await connectDB()
    const tenants = await Tenant.find({ _id: { $in: tenantIds } }).lean()
    const withAddress = tenants.filter((t: any) => t.address)

    if (withAddress.length === 0) {
      return NextResponse.json({ success: false, error: 'No tenants with addresses found' }, { status: 400 })
    }

    const doc = new PDFDocument({ size: 'LETTER', margin: 0 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    // Avery 5160 specs
    const labelW = 189   // 2.625" in points
    const labelH = 72    // 1" in points
    const topMargin = 36 // 0.5"
    const leftMargin = 13.5 // 0.1875"
    const hGap = 9       // 0.125"
    const cols = 3
    const rows = 10
    const labelsPerPage = cols * rows

    withAddress.forEach((tenant: any, idx: number) => {
      if (idx > 0 && idx % labelsPerPage === 0) doc.addPage()
      const pageIdx = idx % labelsPerPage
      const col = pageIdx % cols
      const row = Math.floor(pageIdx / cols)
      const x = leftMargin + col * (labelW + hGap) + 8
      const y = topMargin + row * labelH + 12

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
        .text(`${tenant.firstName} ${tenant.lastName}`, x, y, { width: labelW - 16 })
      doc.font('Helvetica').fontSize(9)
      if (tenant.address) doc.text(tenant.address, x, y + 14, { width: labelW - 16 })
      const cityLine = [tenant.city, tenant.state, tenant.zip].filter(Boolean).join(', ')
      if (cityLine) doc.text(cityLine, x, y + 26, { width: labelW - 16 })
    })

    doc.end()
    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="mailing-labels.pdf"',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
