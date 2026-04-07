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

export async function sendSMS(to: string, body: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SMS DEV] To: ${to}, Body: ${body}`)
    return
  }

  const twilioClient = getClient()
  if (!twilioClient || !fromNumber) {
    console.error('[SMS] Twilio not configured')
    return
  }

  await twilioClient.messages.create({
    body,
    from: fromNumber,
    to,
  })
}

export default getClient
