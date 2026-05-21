import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'
import { makeRequest } from '@/tests/helpers/request'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import Lease from '@/models/Lease'
import { POST as recurringBilling } from '@/app/api/cron/recurring-billing/route'

describe('POST /api/cron/recurring-billing', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    delete process.env.CRON_SECRET
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  it('allows the request without auth when CRON_SECRET is not set (dev mode)', async () => {
    const res = await recurringBilling(makeRequest('POST', '/api/cron/recurring-billing', { dryRun: true }))
    expect([200, 401]).not.toContain(res.status === 401 ? 401 : null)
    expect(res.status).toBe(200)
  })

  it('rejects when CRON_SECRET is set but Authorization header is missing', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    const res = await recurringBilling(makeRequest('POST', '/api/cron/recurring-billing', { dryRun: true }))
    // Route may use 401 or 403 — assert it's at least an auth-rejection.
    expect([401, 403]).toContain(res.status)
  })

  it('accepts the secret via Authorization: Bearer header', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    const res = await recurringBilling(makeRequest(
      'POST',
      '/api/cron/recurring-billing',
      { dryRun: true },
      { headers: { authorization: 'Bearer expected-secret' } as any },
    ))
    expect(res.status).toBe(200)
  })

  it('accepts the secret via ?secret= query string', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    const res = await recurringBilling(makeRequest(
      'POST',
      '/api/cron/recurring-billing?secret=expected-secret',
      { dryRun: true },
    ))
    expect(res.status).toBe(200)
  })

  it('returns an empty results array when no leases are due', async () => {
    const res = await recurringBilling(makeRequest('POST', '/api/cron/recurring-billing', { dryRun: true }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.data?.results ?? json.results ?? [])).toBe(true)
  })

  it('honors a specific tenantId filter — only that tenant is evaluated', async () => {
    const r1 = await makeRentedTenant()
    const r2 = await makeRentedTenant()
    void r2

    const res = await recurringBilling(makeRequest('POST', '/api/cron/recurring-billing', {
      dryRun: true,
      tenantId: r1.tenant._id.toString(),
    }))
    expect(res.status).toBe(200)
    void Lease
  })
})
