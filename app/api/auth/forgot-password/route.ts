import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import PasswordResetToken from '@/models/PasswordResetToken'
import { createResetToken, buildResetUrl, resetEmailHtml } from '@/lib/passwordReset'
import { sendEmail } from '@/lib/email'

const Body = z.object({ email: z.string().email() })

const ipAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_MAX = 10

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipAttempts.get(ip)
  if (!entry || entry.resetAt < now) {
    ipAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_MAX) return false
  entry.count++
  return true
}

/**
 * POST /api/auth/forgot-password
 * Public. Always returns success — never reveals whether the email exists,
 * which would let an attacker enumerate the tenant base.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts — try again later.' },
      { status: 429 },
    )
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    // Same shape as success — don't leak validation details either.
    return NextResponse.json({ success: true })
  }

  const email = parsed.data.email.toLowerCase().trim()

  try {
    await connectDB()
    const tenant = await Tenant.findOne({ email })
    if (tenant && !tenant.loginDisabled) {
      const { rawToken, tokenHash, expiresAt } = createResetToken()
      await PasswordResetToken.create({
        tenantId: tenant._id,
        tokenHash,
        expiresAt,
        issuedBy: 'self',
      })
      const url = buildResetUrl(rawToken)
      try {
        await sendEmail(
          tenant.email,
          'Reset your Tuscany Storage password',
          resetEmailHtml({ firstName: tenant.firstName, resetUrl: url }),
        )
      } catch (err) {
        console.error('forgot-password email send failed', err)
      }
    }
  } catch (err) {
    console.error('forgot-password failed', err)
  }

  return NextResponse.json({ success: true })
}
