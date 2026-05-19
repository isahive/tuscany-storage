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
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SMS DEV] To: ${to}, Body: ${body}`)
    return null
  }

  const twilioClient = getClient()
  if (!twilioClient || !fromNumber) {
    console.error('[SMS] Twilio not configured')
    return null
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
