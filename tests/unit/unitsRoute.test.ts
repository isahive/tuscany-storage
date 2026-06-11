import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeUnit } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import { GET as listUnits } from '@/app/api/units/route'

describe('GET /api/units (admin only)', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    vi.mocked(getServerSession).mockResolvedValue(adminSession() as never)
  })
  afterAll(async () => { await stopTestDb() })

  it('forbids unauthenticated callers', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never)
    const res = await listUnits(makeRequest('GET', '/api/units') as any)
    expect(res.status).toBe(403)
  })

  it('forbids non-admin tenants', async () => {
    vi.mocked(getServerSession).mockResolvedValue(tenantSession('t') as never)
    const res = await listUnits(makeRequest('GET', '/api/units') as any)
    expect(res.status).toBe(403)
  })

  it('returns all units with pagination metadata', async () => {
    await makeUnit({ unitNumber: 'A1', price: 5000 })
    await makeUnit({ unitNumber: 'A2', price: 7000 })
    await makeUnit({ unitNumber: 'A3', price: 10000 })

    const res = await listUnits(makeRequest('GET', '/api/units?limit=10') as any)
    const json = await readJson<any>(res)
    expect(json.success).toBe(true)
    expect(json.data.total).toBe(3)
    expect(json.data.items).toHaveLength(3)
    expect(json.data.items[0]).toHaveProperty('displayStatus')
  })

  it('filters by status', async () => {
    await makeUnit({ status: 'available' })
    await makeUnit({ status: 'occupied' })
    await makeUnit({ status: 'occupied' })

    const res = await listUnits(makeRequest('GET', '/api/units?status=occupied') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(2)
  })

  it('filters by type', async () => {
    await makeUnit({ type: 'standard' })
    await makeUnit({ type: 'climate_controlled' })

    const res = await listUnits(makeRequest('GET', '/api/units?type=climate_controlled') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(1)
  })

  it('filters by size', async () => {
    await makeUnit({ size: '10x10' })
    await makeUnit({ size: '10x20' })

    const res = await listUnits(makeRequest('GET', '/api/units?size=10x10') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(1)
  })

  it('filters by minPrice + maxPrice range', async () => {
    await makeUnit({ price: 5000, unitNumber: 'P5' })
    await makeUnit({ price: 10000, unitNumber: 'P10' })
    await makeUnit({ price: 15000, unitNumber: 'P15' })

    const res = await listUnits(makeRequest('GET', '/api/units?minPrice=6000&maxPrice=12000') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(1)
    expect(json.data.items[0].unitNumber).toBe('P10')
  })

  it('enriches with computed displayStatus', async () => {
    await makeUnit({ status: 'available' })
    const res = await listUnits(makeRequest('GET', '/api/units') as any)
    const json = await readJson<any>(res)
    expect(json.data.items[0].displayStatus).toBe('available')
  })
})
