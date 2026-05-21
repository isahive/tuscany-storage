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
import Promotion from '@/models/Promotion'
import Lease from '@/models/Lease'
import { POST as addPromo } from '@/app/api/admin/leases/[id]/add-promotion/route'
import { POST as removePromo } from '@/app/api/admin/leases/[id]/remove-promotion/route'

async function makePromotion(over: Record<string, unknown> = {}) {
  return Promotion.create({
    name: 'Half Off First Month',
    description: '',
    method: 'manual',
    discountType: 'percentage',
    discountValue: 50,
    durationCycles: 1,
    noExpiration: true,
    allUnitTypes: true,
    unitTypes: [],
    startDate: new Date(),
    status: 'active',
    appliedCount: 0,
    ...over,
  })
}

describe('POST /api/admin/leases/[id]/add-promotion', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const { lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await addPromo(makeRequest('POST', '', { promotionId: 'x' }) as any, { params: { id: lease._id.toString() } })
    expect(res.status).toBe(403)
  })

  it('rejects when promotionId is missing', async () => {
    const { lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addPromo(makeRequest('POST', '', {}) as any, { params: { id: lease._id.toString() } })
    expect(res.status).toBe(400)
  })

  it('404s for unknown lease', async () => {
    const promo = await makePromotion()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addPromo(
      makeRequest('POST', '', { promotionId: promo._id.toString() }) as any,
      { params: { id: '507f1f77bcf86cd799439099' } },
    )
    expect(res.status).toBe(404)
  })

  it('attaches the promotion and increments appliedCount', async () => {
    const { lease } = await makeRentedTenant()
    const promo = await makePromotion()

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addPromo(
      makeRequest('POST', '', { promotionId: promo._id.toString() }) as any,
      { params: { id: lease._id.toString() } },
    )
    expect(res.status).toBe(200)
    const updated = await Lease.findById(lease._id)
    expect(updated!.appliedPromotionId?.toString()).toBe(promo._id.toString())

    const updatedPromo = await Promotion.findById(promo._id)
    expect(updatedPromo!.appliedCount).toBe(1)
  })

  it('refuses to attach when a promo is already on the lease', async () => {
    const { lease } = await makeRentedTenant()
    const promo = await makePromotion()
    await Lease.findByIdAndUpdate(lease._id, { appliedPromotionId: promo._id })

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await addPromo(
      makeRequest('POST', '', { promotionId: promo._id.toString() }) as any,
      { params: { id: lease._id.toString() } },
    )
    expect(res.status).toBe(409)
  })
})

describe('POST /api/admin/leases/[id]/remove-promotion', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const { lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await removePromo(makeRequest('POST', '') as any, { params: { id: lease._id.toString() } })
    expect(res.status).toBe(403)
  })

  it('409s when no promo is attached', async () => {
    const { lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await removePromo(makeRequest('POST', '') as any, { params: { id: lease._id.toString() } })
    expect(res.status).toBe(409)
  })

  it('clears the promotion id on success and leaves appliedCount alone (historical)', async () => {
    const { lease } = await makeRentedTenant()
    const promo = await makePromotion({ appliedCount: 5 })
    await Lease.findByIdAndUpdate(lease._id, { appliedPromotionId: promo._id })

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await removePromo(makeRequest('POST', '') as any, { params: { id: lease._id.toString() } })
    expect(res.status).toBe(200)
    const updated = await Lease.findById(lease._id)
    expect(updated!.appliedPromotionId).toBeUndefined()
    const stillPromo = await Promotion.findById(promo._id)
    expect(stillPromo!.appliedCount).toBe(5)
  })
})
