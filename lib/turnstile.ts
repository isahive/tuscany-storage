/**
 * Cloudflare Turnstile server-side token verification.
 *
 * Shared by the contact form and payment endpoints so the verification logic
 * lives in one place. In dev / preview without a real secret key configured,
 * Cloudflare's always-passes test secret is used so local flows aren't blocked.
 */
const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA'

export async function verifyTurnstileToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false
  const secret = process.env.TURNSTILE_SECRET_KEY ?? TURNSTILE_TEST_SECRET
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
