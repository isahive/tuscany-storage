import crypto from 'crypto'

/** How long a freshly-minted reset token stays valid. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 24 * 7 * 1000 // 7 days

/**
 * Produces a (rawToken, tokenHash, expiresAt) triple.
 *
 * - `rawToken` is what we put in the email/reset URL — sent to the user once.
 * - `tokenHash` is what we persist — SHA-256 so a DB leak can't reset accounts.
 * - `expiresAt` is `RESET_TOKEN_TTL_MS` in the future.
 */
export function createResetToken(now: Date = new Date()): {
  rawToken: string
  tokenHash: string
  expiresAt: Date
} {
  const rawToken = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS)
  return { rawToken, tokenHash, expiresAt }
}

/** SHA-256 hex digest of the raw token. Stable across processes. */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

export type TokenStatus = 'valid' | 'expired' | 'used' | 'unknown'

export interface StoredToken {
  expiresAt: Date
  usedAt?: Date | null
}

/** Returns the status of a token record relative to `now`. */
export function tokenStatus(
  stored: StoredToken | null | undefined,
  now: Date = new Date(),
): TokenStatus {
  if (!stored) return 'unknown'
  if (stored.usedAt) return 'used'
  if (stored.expiresAt.getTime() <= now.getTime()) return 'expired'
  return 'valid'
}

/** Build the absolute URL the user clicks to land on /reset-password. */
export function buildResetUrl(rawToken: string, appUrl?: string | null): string {
  const base = (appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  )
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`
}

/** HTML body for the reset email. Plain inline styles so any client renders it. */
export function resetEmailHtml(opts: {
  firstName?: string | null
  resetUrl: string
  ttlDays?: number
}): string {
  const name = (opts.firstName || '').trim() || 'there'
  const ttlDays = opts.ttlDays ?? Math.round(RESET_TOKEN_TTL_MS / (1000 * 60 * 60 * 24))
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#F7F2E9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1C0F06;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#FFFFFF;border-radius:8px;border:1px solid #EDE5D8;">
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-family:'Playfair Display',serif;font-size:22px;color:#1C0F06;">Reset your password</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ${escapeHtml(name)},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
            We received a request to reset your Tuscany Village Self Storage password. Click the button below to choose a new one. This link is valid for ${ttlDays} day${ttlDays === 1 ? '' : 's'}.
          </p>
          <p style="margin:24px 0;text-align:center;">
            <a href="${opts.resetUrl}" style="display:inline-block;background:#8CA87C;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:4px;font-weight:600;font-size:15px;">
              Set a new password
            </a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#6B6259;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="margin:0 0 16px;font-size:12px;color:#3E5DAA;word-break:break-all;">${opts.resetUrl}</p>
          <p style="margin:24px 0 0;font-size:13px;color:#6B6259;">If you didn't request this, you can ignore this email — your password won't change.</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #EDE5D8;font-size:12px;color:#6B6259;">
          Tuscany Village Self Storage · (865) 426-2100
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
