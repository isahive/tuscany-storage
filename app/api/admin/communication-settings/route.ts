import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Settings from '@/models/Settings'

/** GET /api/admin/communication-settings — return communication settings */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    let settings = await Settings.findOne({}).lean() as any
    if (!settings) {
      settings = await Settings.create({})
      settings = settings.toObject()
    }

    return NextResponse.json({
      success: true,
      data: {
        notificationEmail: settings.notificationEmail ?? '',
        replyToEmail: settings.replyToEmail ?? '',
        fromDisplayName: settings.fromDisplayName ?? '',
        reminderDaysBefore: settings.reminderDaysBefore ?? 3,
        textOnCreditWithoutPayment: settings.textOnCreditWithoutPayment ?? false,
        textOnOnlineRental: settings.textOnOnlineRental ?? false,
        printInvoiceReminders: settings.printInvoiceReminders ?? false,
        printFormat: settings.printFormat ?? 'letter',
        invoiceHeader: settings.invoiceHeader ?? '',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/** PUT /api/admin/communication-settings — update communication settings */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()

    // Whitelist allowed fields
    const allowedFields = [
      'notificationEmail', 'replyToEmail', 'fromDisplayName',
      'reminderDaysBefore', 'textOnCreditWithoutPayment',
      'textOnOnlineRental', 'printInvoiceReminders',
      'printFormat', 'invoiceHeader',
    ]

    const update: Record<string, any> = {}
    for (const key of allowedFields) {
      if (key in body) {
        update[key] = body[key]
      }
    }

    let settings = await Settings.findOne({})
    if (!settings) {
      settings = await Settings.create(update)
    } else {
      Object.assign(settings, update)
      await settings.save()
    }

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
