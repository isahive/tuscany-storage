import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import PDFDocument from 'pdfkit'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { wrapTenantEmail } from '@/lib/emailLayout'
import { getSettings } from '@/lib/getSettings'
import { buildPlaceholders } from '@/lib/sendNotification'
import { replacePlaceholders } from '@/lib/templatePlaceholders'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import NotificationTemplate from '@/models/NotificationTemplate'
import Notification from '@/models/Notification'

const schema = z.object({
  templateId: z.string().min(1),
  contactMethod: z.enum(['email', 'print']),
  printFormat: z.enum(['letter', 'postcard']).optional(),
  leaseId: z.string().optional(),
  includeTemplateTitleHeader: z.boolean().optional(),
})

interface RouteContext {
  params: { id: string }
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function generateTemplatePdf(args: {
  title: string
  bodyHtml: string
  format: 'letter' | 'postcard'
  includeTitle: boolean
  tenantName: string
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: args.format === 'postcard' ? [432, 288] : 'LETTER',
      margin: args.format === 'postcard' ? 24 : 54,
    })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    if (args.includeTitle) {
      doc.font('Helvetica-Bold').fontSize(args.format === 'postcard' ? 13 : 16).text(args.title)
      doc.moveDown(args.format === 'postcard' ? 0.75 : 1)
    }

    doc.font('Helvetica').fontSize(args.format === 'postcard' ? 9 : 11)
    doc.text(htmlToText(args.bodyHtml), {
      lineGap: args.format === 'postcard' ? 2 : 4,
      align: 'left',
    })

    doc.end()
  })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const [tenant, template, settings] = await Promise.all([
      Tenant.findById(params.id),
      NotificationTemplate.findById(parsed.data.templateId).lean(),
      getSettings(),
    ])

    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    let lease = null
    let unit = null
    if (parsed.data.leaseId) {
      lease = await Lease.findOne({ _id: parsed.data.leaseId, tenantId: tenant._id })
    } else {
      lease = await Lease.findOne({
        tenantId: tenant._id,
        status: { $in: ['active', 'pending_moveout'] },
      }).sort({ createdAt: -1 })
    }
    if (lease) {
      unit = await Unit.findById(lease.unitId).lean() as { unitNumber?: string; size?: string; price?: number } | null
    }

    const placeholders = await buildPlaceholders({
      tenant,
      unitNumber: unit?.unitNumber,
      unitSize: unit?.size,
      monthlyRate: lease?.monthlyRate ?? unit?.price,
      balance: tenant.balance,
      dueDate: lease?.startDate,
    })

    const subject = replacePlaceholders(template.emailSubject || template.name, placeholders)
    const emailBody = replacePlaceholders(template.emailContent || '', placeholders)
    const printSource = parsed.data.printFormat === 'postcard' && template.postcardContent
      ? template.postcardContent
      : template.emailContent
    const printBody = replacePlaceholders(printSource || '', placeholders)

    if (parsed.data.contactMethod === 'email') {
      if (!tenant.email) {
        return NextResponse.json({ success: false, error: 'Tenant has no email address' }, { status: 400 })
      }
      if (!emailBody.trim()) {
        return NextResponse.json({ success: false, error: 'Selected template has no email content' }, { status: 400 })
      }

      const wrapped = wrapTenantEmail(emailBody, settings)
      await sendEmail(tenant.email, subject, wrapped)

      await Notification.create({
        tenantId: tenant._id,
        type: 'custom',
        channel: 'email',
        subject,
        body: emailBody,
        status: 'sent',
        sentAt: new Date(),
        templateName: template.name,
      })

      return NextResponse.json({ success: true, data: { sent: true } })
    }

    if (!printBody.trim()) {
      return NextResponse.json({ success: false, error: 'Selected template has no printable content' }, { status: 400 })
    }

    const pdf = await generateTemplatePdf({
      title: template.name,
      bodyHtml: printBody,
      format: parsed.data.printFormat ?? 'letter',
      includeTitle: parsed.data.includeTemplateTitleHeader ?? true,
      tenantName: `${tenant.firstName} ${tenant.lastName}`.trim(),
    })

    const filename = `${template.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'template-letter'}.pdf`

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
