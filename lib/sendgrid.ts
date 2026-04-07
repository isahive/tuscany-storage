import sgMail from '@sendgrid/mail'

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@tuscanystorage.com'

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[EMAIL DEV] To: ${to}, Subject: ${subject}`)
    return
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.error('[EMAIL] SendGrid not configured')
    return
  }

  await sgMail.send({
    to,
    from: fromEmail,
    subject,
    html,
  })
}

export default sgMail
