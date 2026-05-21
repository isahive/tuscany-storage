import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyTurnstileToken } from './turnstile'

describe('verifyTurnstileToken', () => {
  beforeEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  it('returns false for null / undefined / empty token without contacting Cloudflare', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await verifyTurnstileToken(null)).toBe(false)
    expect(await verifyTurnstileToken(undefined)).toBe(false)
    expect(await verifyTurnstileToken('')).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns true when Cloudflare responds success:true', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ success: true }),
    }) as Response))
    expect(await verifyTurnstileToken('valid-token')).toBe(true)
  })

  it('returns false when Cloudflare responds success:false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    }) as Response))
    expect(await verifyTurnstileToken('bad-token')).toBe(false)
  })

  it('uses the public test secret when TURNSTILE_SECRET_KEY is unset', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const fetchSpy = vi.fn(async () => ({ json: async () => ({ success: true }) } as Response))
    vi.stubGlobal('fetch', fetchSpy)
    await verifyTurnstileToken('tok')
    const body = (fetchSpy.mock.calls[0][1] as RequestInit).body as URLSearchParams
    expect(body.get('secret')).toBe('1x0000000000000000000000000000000AA')
  })

  it('forwards the configured TURNSTILE_SECRET_KEY when set', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'real-secret')
    const fetchSpy = vi.fn(async () => ({ json: async () => ({ success: true }) } as Response))
    vi.stubGlobal('fetch', fetchSpy)
    await verifyTurnstileToken('tok')
    const body = (fetchSpy.mock.calls[0][1] as RequestInit).body as URLSearchParams
    expect(body.get('secret')).toBe('real-secret')
  })

  it('swallows network errors and returns false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    expect(await verifyTurnstileToken('tok')).toBe(false)
  })
})
