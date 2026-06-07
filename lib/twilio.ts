import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER

let client: ReturnType<typeof twilio> | null = null

function getClient() {
  if (!client && accountSid && authToken) {
    client = twilio(accountSid, authToken)
  }
  return client
}

export async function sendSMS(to: string, body: string): Promise<string | null> {
  // Hard safety gate: only send real SMS when explicitly running in production.
  // If NODE_ENV is unset, 'development', 'dev', 'test', or anything else, suppress.
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[SMS GUARD] suppressed (NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}) — To: ${to}, Body: ${body}`,
    )
    return null
  }

  const twilioClient = getClient()
  if (!twilioClient || !fromNumber) {
    // Loud failure in prod — callers track this and record a 'failed'
    // Notification so the admin sees the dispatch gap.
    throw new Error(
      'SMS service not configured: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER missing',
    )
  }

  const message = await twilioClient.messages.create({
    body,
    from: fromNumber,
    to,
    // Twilio reports delivery state asynchronously to this webhook. Falls
    // back to message-create's initial status when not configured.
    ...(process.env.TWILIO_STATUS_CALLBACK_URL
      ? { statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL }
      : {}),
  })

  return message.sid ?? null
}

export default getClient
