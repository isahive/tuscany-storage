import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import MoveOutRequest from '@/models/MoveOutRequest'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Payment from '@/models/Payment'
import { renderTemplate } from '@/lib/sendNotification'
import { getSettings } from '@/lib/getSettings'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, ' • ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function buildPdf(
  unitNumber: string,
  facilityName: string,
  body: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(18).font('Helvetica-Bold').text(`Unit ${unitNumber} Move Out Receipt`, { align: 'center' })
    doc.moveDown(1.5)
    doc.fontSize(11).font('Helvetica').text(body, { align: 'left' })
    doc.moveDown(1)
    doc.fontSize(9).fillColor('#666').text(facilityName, { align: 'center' })

    doc.end()
  })
}

// GET /api/move-out/[id]/receipt/pdf
// Renders the configurable "Move Out Receipt" template into a printable PDF.
// Pulls textContent first (already plain) and falls back to stripped
// emailContent so admins editing either field see the change reflected here.
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const request = await MoveOutRequest.findById(id)
    if (!request) {
      return NextResponse.json({ success: false, error: 'Move-out request not found' }, { status: 404 })
    }

    const [tenant, unit, settings] = await Promise.all([
      Tenant.findById(request.tenantId),
      Unit.findById(request.unitId).select('unitNumber size').lean() as Promise<{ unitNumber?: string; size?: string } | null>,
      getSettings(),
    ])
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const totals = await Payment.aggregate([
      { $match: { tenantId: request.tenantId, status: { $in: ['pending', 'failed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    const balance = totals[0]?.total ?? 0

    const rendered = await renderTemplate({
      templateName: 'Move Out Receipt',
      tenant,
      unitNumber: unit?.unitNumber,
      unitSize: unit?.size,
      balance,
    })

    const body = rendered
      ? (rendered.smsBody?.trim() || htmlToPlain(rendered.emailHtml))
      : `Move-out completed for unit ${unit?.unitNumber ?? ''}.`

    const buffer = await buildPdf(unit?.unitNumber ?? '', settings.facilityName ?? 'Tuscany Village Self Storage', body)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="move-out-receipt-${id}.pdf"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
