import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import PasswordResetToken from '@/models/PasswordResetToken'
import { hashToken, tokenStatus } from '@/lib/passwordReset'

const Body = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

/**
 * POST /api/auth/reset-password
 * Public. Consumes a one-time token and sets a new password on the tenant.
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
  const { token, password } = parsed.data

  try {
    await connectDB()
    const record = await PasswordResetToken.findOne({ tokenHash: hashToken(token) })
    const status = tokenStatus(record)
    if (status !== 'valid') {
      return NextResponse.json(
        { success: false, error: 'This reset link is no longer valid. Please request a new one.' },
        { status: 400 },
      )
    }

    const hashed = await bcrypt.hash(password, 10)
    const tenant = await Tenant.findByIdAndUpdate(
      record!.tenantId,
      { password: hashed, loginDisabled: false },
      { new: true },
    )
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 })
    }

    record!.usedAt = new Date()
    await record!.save()

    // Invalidate any other outstanding tokens for this tenant — they all
    // resolve to "no longer valid" once one is used.
    await PasswordResetToken.updateMany(
      { tenantId: tenant._id, usedAt: { $exists: false }, _id: { $ne: record!._id } },
      { $set: { usedAt: new Date() } },
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('reset-password failed', err)
    return NextResponse.json({ success: false, error: 'Failed to reset password' }, { status: 500 })
  }
}

/**
 * GET /api/auth/reset-password?token=…
 * Lets the reset page tell the user up front whether a link is expired/used
 * without making them type a new password first.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ success: false, status: 'unknown' as const })
  }
  try {
    await connectDB()
    const record = await PasswordResetToken.findOne({ tokenHash: hashToken(token) })
    return NextResponse.json({ success: true, status: tokenStatus(record) })
  } catch {
    return NextResponse.json({ success: false, status: 'unknown' as const })
  }
}
