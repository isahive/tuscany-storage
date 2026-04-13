import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { replacePlaceholders } from '@/lib/templatePlaceholders'
import Tenant from '@/models/Tenant'
import Notification from '@/models/Notification'
import NotificationTemplate from '@/models/NotificationTemplate'
import Settings from '@/models/Settings'

/**
 * POST /api/admin/email-batches — send email to selected tenants
 * Body: { tenantIds: string[], subject?: string, html?: string, templateId?: string }
 * If templateId is provided, load template and replace placeholders.
 * Otherwise use subject + html directly.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { tenantIds, subject, html, templateId } = body

    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'tenantIds array is required' },
        { status: 400 }
      )
    }

    // Load template if templateId provided
    let emailSubject = subject || ''
    let emailHtml = html || ''

    let template: any = null
    if (templateId) {
      template = await NotificationTemplate.findById(templateId).lean()
      if (!template) {
        return NextResponse.json(
          { success: false, error: 'Template not found' },
          { status: 404 }
        )
      }
      emailSubject = template.emailSubject
      emailHtml = template.emailContent
    }

    if (!emailSubject || !emailHtml) {
      return NextResponse.json(
        { success: false, error: 'Subject and HTML content are required (or provide a templateId)' },
        { status: 400 }
      )
    }

    // Load facility settings for placeholders
    const settings = await Settings.findOne({}).lean() as any

    // Load tenants
    const tenants = await Tenant.find({ _id: { $in: tenantIds } }).lean()

    const results: Array<{ tenantId: string; email: string; status: string; error?: string }> = []

    for (const tenant of tenants as any[]) {
      const placeholderData: Record<string, string> = {
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.email,
        phone: tenant.phone || '',
        balance: ((tenant.balance || 0) / 100).toFixed(2),
        facilityName: settings?.facilityName || 'Tuscany Village Self Storage',
        facilityPhone: settings?.facilityPhone || '',
        facilityAddress: settings?.facilityAddress || '',
        facilityEmail: settings?.facilityEmail || '',
        todayDate: new Date().toLocaleDateString('en-US'),
        gateCode: tenant.gateCode || '',
      }

      const finalSubject = replacePlaceholders(emailSubject, placeholderData)
      const finalHtml = replacePlaceholders(emailHtml, placeholderData)

      try {
        await sendEmail(tenant.email, finalSubject, finalHtml)

        // Log in Notification model
        await Notification.create({
          tenantId: tenant._id,
          type: 'custom',
          channel: 'email',
          subject: finalSubject,
          body: finalHtml,
          status: 'sent',
          sentAt: new Date(),
        })

        results.push({ tenantId: tenant._id.toString(), email: tenant.email, status: 'sent' })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'

        await Notification.create({
          tenantId: tenant._id,
          type: 'custom',
          channel: 'email',
          subject: finalSubject,
          body: finalHtml,
          status: 'failed',
          failureReason: errMsg,
        })

        results.push({ tenantId: tenant._id.toString(), email: tenant.email, status: 'failed', error: errMsg })
      }
    }

    const sentCount = results.filter(r => r.status === 'sent').length
    const failedCount = results.filter(r => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      data: {
        sent: sentCount,
        failed: failedCount,
        total: results.length,
        results,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
