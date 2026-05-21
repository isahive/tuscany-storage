import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { rateLimit } from './rateLimit'

function reqFrom(ip: string, path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { 'x-forwarded-for': ip },
  })
}

describe('rateLimit', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('allows the first request through (returns null)', () => {
    const res = rateLimit(reqFrom('1.1.1.1', '/a'), { maxRequests: 3, windowMs: 60_000 })
    expect(res).toBeNull()
  })

  it('blocks once requests exceed maxRequests within the window', () => {
    const req = reqFrom('2.2.2.2', '/b')
    expect(rateLimit(req, { maxRequests: 2, windowMs: 60_000 })).toBeNull()
    expect(rateLimit(req, { maxRequests: 2, windowMs: 60_000 })).toBeNull()
    const blocked = rateLimit(req, { maxRequests: 2, windowMs: 60_000 })
    expect(blocked).not.toBeNull()
    expect(blocked!.status).toBe(429)
  })

  it('resets the counter after the window elapses', () => {
    const req = reqFrom('3.3.3.3', '/c')
    rateLimit(req, { maxRequests: 1, windowMs: 1000 })
    expect(rateLimit(req, { maxRequests: 1, windowMs: 1000 })).not.toBeNull()

    vi.advanceTimersByTime(1500)

    expect(rateLimit(req, { maxRequests: 1, windowMs: 1000 })).toBeNull()
  })

  it('tracks each (ip, path) bucket independently', () => {
    expect(rateLimit(reqFrom('4.4.4.4', '/x'), { maxRequests: 1 })).toBeNull()
    expect(rateLimit(reqFrom('4.4.4.4', '/y'), { maxRequests: 1 })).toBeNull()
    expect(rateLimit(reqFrom('4.4.4.4', '/x'), { maxRequests: 1 })).not.toBeNull()
  })

  it('falls back to "unknown" IP when no IP header is present', () => {
    const req = new NextRequest('http://localhost:3000/d')
    expect(rateLimit(req, { maxRequests: 1 })).toBeNull()
    expect(rateLimit(req, { maxRequests: 1 })).not.toBeNull()
  })

  it('applies sensible defaults when no opts are passed', () => {
    const req = reqFrom('5.5.5.5', '/default')
    // Defaults: maxRequests = 10. 10 should pass, 11th should block.
    for (let i = 0; i < 10; i++) expect(rateLimit(req)).toBeNull()
    expect(rateLimit(req)).not.toBeNull()
  })
})
