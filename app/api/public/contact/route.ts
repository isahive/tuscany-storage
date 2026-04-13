import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import ContactSubmission from '@/models/ContactSubmission'
import { sendAdminNotification } from '@/lib/email'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    await connectDB()

    const submission = await ContactSubmission.create(parsed.data)

    // Notify admin via email
    await sendAdminNotification(
      `New Contact Form: ${parsed.data.subject}`,
      `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${parsed.data.name} (${parsed.data.email})</p>
        ${parsed.data.phone ? `<p><strong>Phone:</strong> ${parsed.data.phone}</p>` : ''}
        <p><strong>Subject:</strong> ${parsed.data.subject}</p>
        <hr/>
        <p>${parsed.data.message.replace(/\n/g, '<br/>')}</p>
        <hr/>
        <p><small>Submitted at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</small></p>
      `
    ).catch(() => {}) // Don't fail if email fails

    return NextResponse.json({ success: true, data: { id: submission._id } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
