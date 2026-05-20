import { describe, it, expect } from 'vitest'
import {
  createResetToken,
  hashToken,
  tokenStatus,
  buildResetUrl,
  resetEmailHtml,
  RESET_TOKEN_TTL_MS,
} from './passwordReset'

describe('createResetToken', () => {
  it('returns a raw token, its SHA-256 hash, and an expiry in the future', () => {
    const now = new Date('2026-05-20T10:00:00Z')
    const { rawToken, tokenHash, expiresAt } = createResetToken(now)
    expect(rawToken.length).toBeGreaterThan(20)
    expect(hashToken(rawToken)).toBe(tokenHash)
    expect(expiresAt.getTime() - now.getTime()).toBe(RESET_TOKEN_TTL_MS)
  })

  it('generates a different token each call', () => {
    const a = createResetToken()
    const b = createResetToken()
    expect(a.rawToken).not.toBe(b.rawToken)
    expect(a.tokenHash).not.toBe(b.tokenHash)
  })
})

describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('hello')).toBe(hashToken('hello'))
  })
  it('differs for different inputs', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'))
  })
})

describe('tokenStatus', () => {
  const now = new Date('2026-05-20T10:00:00Z')

  it('returns "unknown" when no record', () => {
    expect(tokenStatus(null, now)).toBe('unknown')
    expect(tokenStatus(undefined, now)).toBe('unknown')
  })

  it('returns "used" when usedAt is set', () => {
    expect(
      tokenStatus(
        { expiresAt: new Date('2026-05-25T10:00:00Z'), usedAt: new Date('2026-05-20T11:00:00Z') },
        now,
      ),
    ).toBe('used')
  })

  it('returns "expired" when expiresAt is in the past', () => {
    expect(tokenStatus({ expiresAt: new Date('2026-05-19T10:00:00Z') }, now)).toBe('expired')
  })

  it('treats the exact expiry moment as expired', () => {
    expect(tokenStatus({ expiresAt: now }, now)).toBe('expired')
  })

  it('returns "valid" for an unexpired, unused token', () => {
    expect(tokenStatus({ expiresAt: new Date('2026-05-25T10:00:00Z') }, now)).toBe('valid')
  })
})

describe('buildResetUrl', () => {
  it('joins base URL + /reset-password + encoded token', () => {
    expect(buildResetUrl('abc/def', 'https://example.com/')).toBe(
      'https://example.com/reset-password?token=abc%2Fdef',
    )
  })

  it('falls back to localhost when nothing is configured', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(buildResetUrl('xyz')).toBe('http://localhost:3000/reset-password?token=xyz')
    if (prev) process.env.NEXT_PUBLIC_APP_URL = prev
  })
})

describe('resetEmailHtml', () => {
  it('includes the reset URL and personalizes the greeting', () => {
    const html = resetEmailHtml({
      firstName: 'Jess',
      resetUrl: 'https://x.test/reset-password?token=abc',
    })
    expect(html).toContain('https://x.test/reset-password?token=abc')
    expect(html).toContain('Hi Jess')
  })

  it('escapes HTML in the name to prevent injection', () => {
    const html = resetEmailHtml({
      firstName: '<script>alert(1)</script>',
      resetUrl: 'https://x.test/r',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('falls back to "there" when name missing', () => {
    expect(resetEmailHtml({ resetUrl: 'https://x.test/r' })).toContain('Hi there')
  })
})
