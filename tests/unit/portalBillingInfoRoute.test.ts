import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'
import { readJson } from '@/tests/helpers/request'
import { tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import { GET as getBillingInfo } from '@/app/api/portal/billing-info/route'

describe('GET /api/portal/billing-info', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  it('401s without a session', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await getBillingInfo()
    expect(res.status).toBe(401)
  })

  it('returns autopayEnabled + null paymentMethod for a fresh tenant', async () => {
    const t = await makeTenant({ autopayEnabled: false })
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t._id.toString()) as never)
    const res = await getBillingInfo()
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.autopayEnabled).toBe(false)
    expect(json.data.paymentMethod).toBeNull()
    expect(json.data.hasStripe).toBe(false)
  })

  it('404s on stale session pointing to missing tenant', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('507f1f77bcf86cd799439099') as never)
    const res = await getBillingInfo()
    expect(res.status).toBe(404)
  })
})
