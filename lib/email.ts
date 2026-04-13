import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const fromEmail = process.env.EMAIL_FROM || 'Tuscany Storage <noreply@tuscanystorage.com>'
const adminEmail = process.env.ADMIN_EMAIL || 'Tuscanystorage@gmail.com'

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (process.env.NODE_ENV === 'development' && !resend) {
    console.log(`[EMAIL DEV] To: ${to}, Subject: ${subject}`)
    return
  }

  if (!resend) {
    console.warn('[EMAIL] Resend not configured — set RESEND_API_KEY')
    return
  }

  await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    html,
  })
}

export async function sendAdminNotification(subject: string, html: string): Promise<void> {
  await sendEmail(adminEmail, subject, html)
}

export { resend }
