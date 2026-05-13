import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import ContactSubmission from '@/models/ContactSubmission'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id, message } = await req.json()
    if (!id || !message?.trim()) {
      return NextResponse.json(
        { success: false, error: 'id and message are required' },
        { status: 400 },
      )
    }

    await connectDB()

    const submission = await ContactSubmission.findById(id).lean() as any
    if (!submission) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 })
    }

    const facilityName = 'Tuscany Village Self Storage'
    const adminEmail = process.env.ADMIN_EMAIL || 'Tuscanystorage@gmail.com'

    console.log(`[REPLY] Sending reply to ${submission.email} for submission ${id}`)
    await sendEmail(
      submission.email,
      `Re: Your inquiry to ${facilityName}`,
      `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
          <p>${message.replace(/\n/g, '<br/>')}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="color:#666;font-size:13px;">
            <em>You originally wrote:</em><br/>
            ${submission.message.replace(/\n/g, '<br/>')}
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="color:#999;font-size:12px;">${facilityName}</p>
        </div>
      `,
      { replyTo: adminEmail },
    )
    console.log(`[REPLY] Email delivered for submission ${id}`)

    await ContactSubmission.findByIdAndUpdate(id, {
      status: 'replied',
      repliedAt: new Date(),
      repliedBy: session.user.name ?? 'Admin',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
