import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant, makeUnit } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import { GET as getUnit, PATCH as patchUnit } from '@/app/api/units/[id]/route'
import { POST as releaseUnit } from '@/app/api/admin/units/[id]/release/route'
import { POST as cancelReservation } from '@/app/api/admin/units/[id]/cancel-reservation/route'
import { POST as scheduleAuction } from '@/app/api/admin/units/[id]/schedule-auction/route'
import { POST as markDelinquent } from '@/app/api/admin/units/[id]/mark-delinquent/route'

describe('GET /api/units/[id]', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('404s on unknown id', async () => {
    const res = await getUnit(makeRequest('GET', '') as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    expect(res.status).toBe(404)
  })

  it('returns the unit with computed displayStatus', async () => {
    const u = await makeUnit({ unitNumber: 'X-1', status: 'available' })
    const res = await getUnit(makeRequest('GET', '') as any, { params: Promise.resolve({ id: u._id.toString() }) })
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.unitNumber).toBe('X-1')
    expect(json.data.displayStatus).toBe('available')
  })
})

describe('PATCH /api/units/[id]', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const u = await makeUnit()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await patchUnit(makeRequest('PATCH', '', { price: 8000 }) as any, { params: Promise.resolve({ id: u._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('updates allowed fields', async () => {
    const u = await makeUnit({ price: 5000 })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await patchUnit(makeRequest('PATCH', '', { price: 8000 }) as any, { params: Promise.resolve({ id: u._id.toString() }) })
    expect(res.status).toBe(200)
    const after = await Unit.findById(u._id)
    expect(after!.price).toBe(8000)
  })
})

describe('POST /api/admin/units/[id]/release', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const u = await makeUnit()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await releaseUnit(makeRequest('POST', '') as any, { params: Promise.resolve({ id: u._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('frees the unit + ends the active lease', async () => {
    const { lease, unit } = await makeRentedTenant()

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await releaseUnit(makeRequest('POST', '') as any, { params: Promise.resolve({ id: unit._id.toString() }) })
    expect(res.status).toBe(200)

    const after = await Unit.findById(unit._id)
    expect(after!.status).toBe('available')
    expect(after!.currentTenantId).toBeUndefined()
    expect(after!.currentLeaseId).toBeUndefined()

    const updatedLease = await Lease.findById(lease._id)
    expect(updatedLease!.status).toBe('ended')
  })

  it('404s on unknown unit', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await releaseUnit(makeRequest('POST', '') as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/admin/units/[id]/cancel-reservation', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const u = await makeUnit({ status: 'reserved' })
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await cancelReservation(makeRequest('POST', '') as any, { params: { id: u._id.toString() } })
    expect(res.status).toBe(403)
  })

  it('409s when the unit is not in "reserved" state', async () => {
    const u = await makeUnit({ status: 'available' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await cancelReservation(makeRequest('POST', '') as any, { params: { id: u._id.toString() } })
    expect(res.status).toBe(409)
  })

  it('frees a reserved unit back to available', async () => {
    const u = await makeUnit({ status: 'reserved' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await cancelReservation(makeRequest('POST', '') as any, { params: { id: u._id.toString() } })
    expect(res.status).toBe(200)
    const after = await Unit.findById(u._id)
    expect(after!.status).toBe('available')
  })
})

describe('POST /api/admin/units/[id]/schedule-auction', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const u = await makeUnit()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await scheduleAuction(makeRequest('POST', '', { auctionDate: new Date().toISOString() }) as any, { params: Promise.resolve({ id: u._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('sets auctionDate on the active lease', async () => {
    const { lease, unit } = await makeRentedTenant()
    const auctionDate = new Date('2026-12-31').toISOString()

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await scheduleAuction(
      makeRequest('POST', '', { auctionDate }) as any,
      { params: Promise.resolve({ id: unit._id.toString() }) },
    )
    expect(res.status).toBe(200)

    const updatedLease = await Lease.findById(lease._id)
    expect(updatedLease!.auctionDate?.toISOString()).toBe(auctionDate)
  })

  it('clears auctionDate when null is passed', async () => {
    const { lease, unit } = await makeRentedTenant()
    await Lease.findByIdAndUpdate(lease._id, { auctionDate: new Date('2026-12-31') })

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    await scheduleAuction(
      makeRequest('POST', '', { auctionDate: null }) as any,
      { params: Promise.resolve({ id: unit._id.toString() }) },
    )

    const updatedLease = await Lease.findById(lease._id)
    expect(updatedLease!.auctionDate).toBeFalsy()
  })
})

describe('POST /api/admin/units/[id]/mark-delinquent', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const u = await makeUnit()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await markDelinquent(
      makeRequest('POST', '', { daysUnpaid: 30 }) as any,
      { params: Promise.resolve({ id: u._id.toString() }) },
    )
    expect(res.status).toBe(403)
  })

  it('rejects out-of-range daysUnpaid', async () => {
    const u = await makeUnit()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await markDelinquent(
      makeRequest('POST', '', { daysUnpaid: 0 }) as any,
      { params: Promise.resolve({ id: u._id.toString() }) },
    )
    expect(res.status).toBe(400)
  })

  it('creates a backdated pending charge for the active lease', async () => {
    const { tenant, unit } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await markDelinquent(
      makeRequest('POST', '', { daysUnpaid: 35 }) as any,
      { params: Promise.resolve({ id: unit._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const charges = await Payment.find({ tenantId: tenant._id, type: 'rent', status: 'pending' })
    expect(charges.length).toBeGreaterThanOrEqual(1)
    const dueDate = charges[0].dueDate as Date
    expect(dueDate).toBeInstanceOf(Date)
    // dueDate should be ~35 days in the past
    const daysAgo = (Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    expect(daysAgo).toBeGreaterThan(30)
  })
})
