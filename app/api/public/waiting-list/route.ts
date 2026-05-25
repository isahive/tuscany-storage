import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import WaitingList from '@/models/WaitingList'
import { sendEmail, sendAdminNotification } from '@/lib/email'
import { verifyTurnstileToken } from '@/lib/turnstile'

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  preferredSize: z.string().min(1),
  preferredType: z.string().optional(),
  desiredMoveInDate: z.string().optional(),
  notes: z.string().optional(),
  smsOptIn: z.boolean().optional(),
  turnstileToken: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 })
    }

    const turnstileOk = await verifyTurnstileToken(parsed.data.turnstileToken)
    if (!turnstileOk) {
      return NextResponse.json({ success: false, error: 'Security check failed. Please try again.' }, { status: 400 })
    }

    await connectDB()

    const existing = await WaitingList.findOne({ email: parsed.data.email })
    if (existing) {
      return NextResponse.json({ success: false, error: 'You are already on the waiting list.' }, { status: 409 })
    }

    const entry = await WaitingList.create({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      preferredSize: parsed.data.preferredSize,
      preferredType: parsed.data.preferredType,
      desiredMoveInDate: parsed.data.desiredMoveInDate ? new Date(parsed.data.desiredMoveInDate) : undefined,
      notes: parsed.data.notes,
      smsOptIn: parsed.data.smsOptIn ?? false,
    })

    await sendEmail(
      parsed.data.email,
      'Waiting List Confirmation — Tuscany Village Self Storage',
      `
        <h2>You're on the list!</h2>
        <p>Hi ${parsed.data.name},</p>
        <p>You've been added to our waiting list${parsed.data.preferredSize ? ` for a <strong>${parsed.data.preferredSize}</strong> unit` : ''}. We'll contact you as soon as a matching unit becomes available.</p>
        <br/>
        <p>— Tuscany Village Self Storage<br/>(865) 426-2100</p>
      `,
    ).catch(() => {})

    await sendAdminNotification(
      `New Waiting List Signup: ${parsed.data.name}`,
      `
        <h2>New Waiting List Entry</h2>
        <p><strong>Name:</strong> ${parsed.data.name}</p>
        <p><strong>Email:</strong> ${parsed.data.email}</p>
        <p><strong>Phone:</strong> ${parsed.data.phone}</p>
        <p><strong>Preferred Size:</strong> ${parsed.data.preferredSize}</p>
        ${parsed.data.desiredMoveInDate ? `<p><strong>Desired Move-in:</strong> ${parsed.data.desiredMoveInDate}</p>` : ''}
        ${parsed.data.smsOptIn ? `<p><strong>SMS opt-in:</strong> Yes</p>` : ''}
        ${parsed.data.notes ? `<p><strong>Notes:</strong> ${parsed.data.notes}</p>` : ''}
      `,
    ).catch(() => {})

    return NextResponse.json({ success: true, data: { id: entry._id } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
