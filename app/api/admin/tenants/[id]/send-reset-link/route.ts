import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import PasswordResetToken from '@/models/PasswordResetToken'
import { createResetToken, buildResetUrl, resetEmailHtml } from '@/lib/passwordReset'
import { sendEmail } from '@/lib/email'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/tenants/[id]/send-reset-link
 * Admin issues a password reset link for a tenant — emails the tenant and
 * returns the URL so the operator can also copy it (useful when the customer
 * doesn't receive the email).
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    await connectDB()

    const tenant = await Tenant.findById(id)
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
    }

    const { rawToken, tokenHash, expiresAt } = createResetToken()
    await PasswordResetToken.create({
      tenantId: tenant._id,
      tokenHash,
      expiresAt,
      issuedBy: session.user.id,
    })
    const url = buildResetUrl(rawToken)

    let emailed = false
    let emailError: string | null = null
    try {
      const id = await sendEmail(
        tenant.email,
        'Reset your Tuscany Storage password',
        resetEmailHtml({ firstName: tenant.firstName, resetUrl: url }),
      )
      emailed = id !== null
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Email delivery failed'
      console.error('admin send-reset-link email failed', err)
    }

    return NextResponse.json({
      success: true,
      data: { url, emailed, emailError, expiresAt },
    })
  } catch (err) {
    console.error('admin send-reset-link failed', err)
    return NextResponse.json({ success: false, error: 'Failed to issue reset link' }, { status: 500 })
  }
}
