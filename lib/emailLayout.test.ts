import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { wrapTenantEmail } from './emailLayout'

describe('wrapTenantEmail', () => {
  beforeEach(() => { vi.unstubAllEnvs() })
  afterEach(() => { vi.unstubAllEnvs() })

  it('returns full HTML email shell with body inside', () => {
    const out = wrapTenantEmail('<p>Hello</p>', { facilityName: 'Tuscany' })
    expect(out).toContain('<!doctype html>')
    expect(out).toContain('<table')
    expect(out).toContain('<p>Hello</p>')
    expect(out).toContain('Tuscany')
  })

  it('falls back to the bundled brand logo when emailLogoUrl is blank', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test.local')
    const out = wrapTenantEmail('body', { facilityName: 'F', emailLogoUrl: '' })
    expect(out).toContain('https://app.test.local/images/brand/logo.png')
  })

  it('uses an absolute custom logo URL as-is', () => {
    const out = wrapTenantEmail('body', {
      facilityName: 'F',
      emailLogoUrl: 'https://cdn.example.com/logo.png',
    })
    expect(out).toContain('https://cdn.example.com/logo.png')
  })

  it('absolutizes a relative custom logo URL using NEXT_PUBLIC_APP_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://tuscanystorage.com')
    const out = wrapTenantEmail('body', {
      facilityName: 'F',
      emailLogoUrl: '/uploads/brand.png',
    })
    expect(out).toContain('https://tuscanystorage.com/uploads/brand.png')
  })

  it('escapes facility name into the title and alt text', () => {
    const out = wrapTenantEmail('body', { facilityName: 'Tuscany Storage' })
    expect(out).toMatch(/<title>Tuscany Storage<\/title>/)
    expect(out).toMatch(/alt="Tuscany Storage"/)
  })

  it('omits facility name gracefully when not provided', () => {
    const out = wrapTenantEmail('body', {})
    expect(out).toContain('<title></title>')
    expect(out).toContain('alt=""')
  })

  it('respects whitespace-only emailLogoUrl as blank', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test.local')
    const out = wrapTenantEmail('body', { emailLogoUrl: '   ' })
    expect(out).toContain('https://app.test.local/images/brand/logo.png')
  })
})
