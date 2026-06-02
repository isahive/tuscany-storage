import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import { POST as createIntent } from '@/app/api/payments/intent/route'

describe('POST /api/payments/intent', () => {
  const SAVED_NODE_ENV = process.env.NODE_ENV
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    delete process.env.STRIPE_SECRET_KEY
    // Existing tests assume the dev-mode mock path; preserve that.
    ;(process.env as Record<string, string>).NODE_ENV = 'development'
  })
  afterAll(async () => {
    await stopTestDb()
    ;(process.env as Record<string, string | undefined>).NODE_ENV = SAVED_NODE_ENV
  })

  it('401s without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await createIntent(makeRequest('POST', '', {
      leaseId: 'x', amount: 1000, type: 'rent',
    }))
    expect(res.status).toBe(401)
  })

  it('rejects invalid payload (zod)', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await createIntent(makeRequest('POST', '', {
      leaseId: '', amount: -1, type: 'invalid',
    }))
    expect(res.status).toBe(400)
  })

  it('404s on unknown lease', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await createIntent(makeRequest('POST', '', {
      leaseId: '507f1f77bcf86cd799439099',
      amount: 10000, type: 'rent',
    }))
    expect(res.status).toBe(404)
  })

  it('forbids tenants from creating intents for other people\'s leases', async () => {
    const { lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('different-tenant-id') as never)
    const res = await createIntent(makeRequest('POST', '', {
      leaseId: lease._id.toString(),
      amount: 10000, type: 'rent',
    }))
    expect(res.status).toBe(403)
  })

  it('returns a mock PaymentIntent when Stripe is unconfigured (dev path)', async () => {
    const { tenant, lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await createIntent(makeRequest('POST', '', {
      leaseId: lease._id.toString(),
      amount: 10000, type: 'rent',
    }))
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.paymentIntentId).toMatch(/^pi_mock_/)
    expect(json.data.clientSecret).toContain('_secret_')
  })

  it('503s in production when STRIPE_SECRET_KEY is unset (no fake pi_mock leak)', async () => {
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    const { tenant, lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await createIntent(makeRequest('POST', '', {
      leaseId: lease._id.toString(),
      amount: 10000, type: 'rent',
    }))
    expect(res.status).toBe(503)
    const json = await readJson<any>(res)
    expect(json.error).toMatch(/not configured/i)
  })
})
