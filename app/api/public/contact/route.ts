import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import ContactSubmission from '@/models/ContactSubmission'
import ContactNotificationRecipient from '@/models/ContactNotificationRecipient'
import { sendEmail } from '@/lib/email'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
  turnstileToken: z.string().optional(),
})

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? '1x0000000000000000000000000000000AA'
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    const data = await res.json()
    return data.success === true
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message },
        { status: 400 },
      )
    }

    const { turnstileToken, ...data } = parsed.data

    const valid = await verifyTurnstile(turnstileToken ?? '')
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'CAPTCHA verification failed. Please try again.' },
        { status: 400 },
      )
    }

    await connectDB()

    const submission = await ContactSubmission.create(data)

    // Always notify admin; also include any active custom recipients
    const dbRecipients = await ContactNotificationRecipient.find({ active: true }).lean() as any[]
    const adminFallback = process.env.ADMIN_EMAIL || 'Tuscanystorage@gmail.com'
    const toEmailsSet = new Set([adminFallback, ...dbRecipients.map((r) => r.email as string)])
    const toEmails = Array.from(toEmailsSet)

    try {
      await sendEmail(
        toEmails,
        'New Contact Form Submission',
        `
          <h2>New Contact Form Submission</h2>
          <p><strong>From:</strong> ${data.name} (${data.email})</p>
          ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ''}
          <hr/>
          <p>${data.message.replace(/\n/g, '<br/>')}</p>
          <hr/>
          <p><small>Submitted at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</small></p>
        `,
        { replyTo: data.email },
      )
    } catch (emailErr) {
      console.error('[CONTACT] Failed to send admin notification:', emailErr)
    }

    return NextResponse.json({ success: true, data: { id: submission._id } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
