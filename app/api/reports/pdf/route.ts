import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import PDFDocument from 'pdfkit'

// POST /api/reports/pdf
// Body: { title, columns: [{key,label,width?}], rows: any[], summary?: Record<string,any> }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { title, columns, rows, summary } = await req.json()
    if (!title || !columns || !rows) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    const accent = '#C17B4A'
    const dark = '#1C0F06'
    const pageW = doc.page.width - 80 // margins

    // ── Header ──────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 60).fill(dark)
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
      .text('Tuscany Village Self Storage', 40, 18)
    doc.fontSize(10).font('Helvetica')
      .text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 40, 38)

    // ── Title ────────────────────────────────────────────────────────────
    doc.fillColor(accent).fontSize(16).font('Helvetica-Bold')
      .text(title, 40, 75)
    doc.moveTo(40, 95).lineTo(40 + pageW, 95).lineWidth(2).strokeColor(accent).stroke()

    // ── Summary bar ──────────────────────────────────────────────────────
    let y = 105
    if (summary && Object.keys(summary).length > 0) {
      const entries = Object.entries(summary)
      doc.fontSize(9).font('Helvetica')
      entries.forEach(([k, v], i) => {
        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
        const val = typeof v === 'number' && k.toLowerCase().includes('amount') || k.toLowerCase().includes('total') || k.toLowerCase().includes('revenue') || k.toLowerCase().includes('rent') || k.toLowerCase().includes('credit')
          ? `$${(v as number / 100).toFixed(2)}`
          : String(v)
        const x = 40 + (i % 4) * (pageW / 4)
        const row = Math.floor(i / 4)
        doc.fillColor('#666').text(`${label}:`, x, y + row * 14, { continued: true })
          .fillColor(dark).text(` ${val}`)
      })
      y += Math.ceil(Object.keys(summary).length / 4) * 14 + 10
    }

    // ── Table ────────────────────────────────────────────────────────────
    const colCount = columns.length
    const defaultW = pageW / colCount
    const colWidths: number[] = columns.map((c: any) => c.width || defaultW)
    // Normalize widths to fill page
    const totalW = colWidths.reduce((s: number, w: number) => s + w, 0)
    const scale = pageW / totalW
    const finalWidths = colWidths.map((w: number) => w * scale)

    // Table header
    doc.rect(40, y, pageW, 20).fill('#F5F0E8')
    doc.fillColor(dark).fontSize(8).font('Helvetica-Bold')
    let x = 42
    columns.forEach((col: any, i: number) => {
      doc.text(col.label, x, y + 6, { width: finalWidths[i] - 4, ellipsis: true })
      x += finalWidths[i]
    })
    y += 20

    // Rows
    doc.font('Helvetica').fontSize(7.5).fillColor(dark)
    const maxY = doc.page.height - 60

    for (let ri = 0; ri < rows.length; ri++) {
      if (y > maxY) {
        doc.addPage()
        y = 40
        // Re-draw header
        doc.rect(40, y, pageW, 20).fill('#F5F0E8')
        doc.fillColor(dark).fontSize(8).font('Helvetica-Bold')
        x = 42
        columns.forEach((col: any, i: number) => {
          doc.text(col.label, x, y + 6, { width: finalWidths[i] - 4, ellipsis: true })
          x += finalWidths[i]
        })
        y += 20
        doc.font('Helvetica').fontSize(7.5).fillColor(dark)
      }

      if (ri % 2 === 1) {
        doc.rect(40, y, pageW, 16).fill('#FDFBF7')
        doc.fillColor(dark)
      }

      x = 42
      const row = rows[ri]
      columns.forEach((col: any, i: number) => {
        let val = row[col.key]
        if (val === null || val === undefined) val = ''
        // Format dates
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
          val = new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }
        // Format money
        if (col.format === 'money' && typeof val === 'number') {
          val = `$${(val / 100).toFixed(2)}`
        }
        doc.text(String(val), x, y + 4, { width: finalWidths[i] - 4, ellipsis: true })
        x += finalWidths[i]
      })
      y += 16
    }

    // ── Footer ──────────────────────────────────────────────────────────
    doc.fontSize(7).fillColor('#999')
      .text(
        `Generated ${new Date().toLocaleString('en-US')} — ${rows.length} record(s)`,
        40, doc.page.height - 35,
        { width: pageW, align: 'center' },
      )

    doc.end()

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${title.replace(/\s+/g, '_')}.pdf"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
