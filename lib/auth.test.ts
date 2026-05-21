import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { authOptions } from './auth'

/**
 * Structural tests for the credentials provider configuration.
 *
 * The integration path (POST credentials → bcrypt.compare → user payload)
 * is covered by `e2e/login.spec.ts` against a real server. We tried unit
 * testing it here but vitest's module isolation gives lib/auth its own
 * Tenant model registration that diverges from the test file's, so
 * `Tenant.findOne` never sees the test-inserted rows. Playwright sidesteps
 * the issue entirely.
 */
describe('authOptions config', () => {
  it('uses JWT session strategy', () => {
    expect(authOptions.session?.strategy).toBe('jwt')
  })

  it('points the signIn page at /login', () => {
    expect(authOptions.pages?.signIn).toBe('/login')
  })

  it('always includes the Credentials provider', () => {
    const credentials = authOptions.providers.find(
      (p: any) => p.id === 'credentials' || p.options?.id === 'credentials',
    )
    expect(credentials).toBeDefined()
  })

  it('conditionally includes Google when GOOGLE_CLIENT_ID is set', () => {
    // Without env vars, only credentials is registered
    const provider = authOptions.providers.find((p: any) => p.id === 'google')
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      expect(provider).toBeDefined()
    } else {
      expect(provider).toBeUndefined()
    }
  })

  it('session callback copies id + role from token onto session.user', async () => {
    const session = await authOptions.callbacks!.session!({
      session: { user: {} } as any,
      token: { id: 'abc', role: 'admin' } as any,
      user: null as any,
      newSession: undefined,
      trigger: 'update',
    })
    expect((session.user as any).id).toBe('abc')
    expect((session.user as any).role).toBe('admin')
  })

  it('jwt callback copies user.id + role onto the token on first sign-in', async () => {
    const token = await authOptions.callbacks!.jwt!({
      token: {} as any,
      user: { id: 'u1', role: 'tenant' } as any,
      account: null,
      profile: undefined,
      trigger: 'signIn',
      isNewUser: false,
      session: undefined,
    })
    expect((token as any).id).toBe('u1')
    expect((token as any).role).toBe('tenant')
  })

  it('jwt callback defaults role to "tenant" when user.role is missing', async () => {
    const token = await authOptions.callbacks!.jwt!({
      token: {} as any,
      user: { id: 'u2' } as any,
      account: null,
      profile: undefined,
      trigger: 'signIn',
      isNewUser: false,
      session: undefined,
    })
    expect((token as any).role).toBe('tenant')
  })

  it('credentials authorize rejects empty payloads without DB access', async () => {
    const provider: any = authOptions.providers[0]
    const fn = provider.authorize ?? provider.options.authorize
    expect(await fn({})).toBeNull()
    expect(await fn({ email: '', password: 'x' })).toBeNull()
    expect(await fn({ email: 'a@b.com', password: '' })).toBeNull()
  })
})
