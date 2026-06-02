import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { adminSession, tenantSession } from '@/tests/helpers/session'
import { makeTenant, makeUnit, makeLease } from '@/tests/helpers/factories'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import { GET as previewBillingDay } from '@/app/api/admin/billing-day-preview/route'

function req(qs: string) {
  return new Request(`http://localhost/api/admin/billing-day-preview?${qs}`, { method: 'GET' }) as any
}

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })

beforeEach(async () => {
  await clearTestDb()
  vi.mocked(getServerSession).mockReset()
})

describe('GET /api/admin/billing-day-preview', () => {
  it('403s for non-admin sessions', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t1'))
    const res = await previewBillingDay(req('anchor=first_of_month&customDay=1'))
    expect(res.status).toBe(403)
  })

  it('400s on invalid anchor', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const res = await previewBillingDay(req('anchor=foo&customDay=1'))
    expect(res.status).toBe(400)
  })

  it('400s on customDay outside 1..28', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const res = await previewBillingDay(req('anchor=custom_day&customDay=31'))
    expect(res.status).toBe(400)
  })

  it('counts active leases that would change for first_of_month', async () => {
    const t1 = await makeTenant()
    const t2 = await makeTenant()
    const t3 = await makeTenant()
    const u1 = await makeUnit()
    const u2 = await makeUnit()
    const u3 = await makeUnit()
    await makeLease(t1._id, u1._id, { billingDay: 1,  status: 'active', startDate: new Date('2026-04-01Z') })
    await makeLease(t2._id, u2._id, { billingDay: 15, status: 'active', startDate: new Date('2026-04-15Z') })
    await makeLease(t3._id, u3._id, { billingDay: 28, status: 'active', startDate: new Date('2026-04-28Z') })

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const res = await previewBillingDay(req('anchor=first_of_month&customDay=1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual({ scanned: 3, wouldChange: 2 })
  })

  it('does NOT include ended leases in the count', async () => {
    const t1 = await makeTenant()
    const u1 = await makeUnit()
    await makeLease(t1._id, u1._id, { billingDay: 10, status: 'active', startDate: new Date('2026-04-10Z') })

    const t2 = await makeTenant()
    const u2 = await makeUnit()
    await makeLease(t2._id, u2._id, { billingDay: 10, status: 'ended', startDate: new Date('2026-04-10Z') })

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const res = await previewBillingDay(req('anchor=first_of_month&customDay=1'))
    const json = await res.json()
    expect(json.data).toEqual({ scanned: 1, wouldChange: 1 })
  })

  it('returns wouldChange=0 when nothing would change', async () => {
    const t = await makeTenant()
    const u = await makeUnit()
    await makeLease(t._id, u._id, { billingDay: 1, status: 'active', startDate: new Date('2026-04-01Z') })

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
    const res = await previewBillingDay(req('anchor=first_of_month&customDay=1'))
    const json = await res.json()
    expect(json.data).toEqual({ scanned: 1, wouldChange: 0 })
  })
})
