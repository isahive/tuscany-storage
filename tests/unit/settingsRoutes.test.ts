import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import Settings from '@/models/Settings'
import { GET as getSettingsRoute, PUT as putSettings } from '@/app/api/settings/route'
import { GET as getPublicSettings } from '@/app/api/settings/public/route'

describe('GET /api/settings', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('rejects unauthenticated callers', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await getSettingsRoute()
    expect(res.status).toBe(401)
  })

  it('returns defaults when no settings doc exists', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await getSettingsRoute()
    const json = await readJson<{ success: boolean; data: any }>(res)
    expect(json.success).toBe(true)
    expect(json.data.facilityName).toContain('Tuscany')
  })

  it('returns the stored Settings doc when one exists', async () => {
    await Settings.create({ facilityName: 'Hardware Tested' })
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await getSettingsRoute()
    const json = await readJson<{ data: any }>(res)
    expect(json.data.facilityName).toBe('Hardware Tested')
  })
})

describe('PUT /api/settings', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const req = makeRequest('PUT', '/api/settings', { facilityName: 'X' })
    const res = await putSettings(req)
    expect(res.status).toBe(403)
  })

  it('upserts settings and returns the updated doc', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const req = makeRequest('PUT', '/api/settings', {
      facilityName: 'Updated Storage',
      facilityPhone: '555-1212',
    })
    const res = await putSettings(req)
    expect(res.status).toBe(200)
    const json = await readJson<{ data: any }>(res)
    expect(json.data.facilityName).toBe('Updated Storage')

    const stored = await Settings.findOne({})
    expect(stored?.facilityName).toBe('Updated Storage')
  })

  it('rejects invalid payloads via zod', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    // billingDaysBeforeDue must be a non-negative int
    const req = makeRequest('PUT', '/api/settings', { billingDaysBeforeDue: -1 })
    const res = await putSettings(req)
    expect(res.status).toBe(400)
  })

  it('rejects duplicate reservation fees on the same unit type', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const req = makeRequest('PUT', '/api/settings', {
      unitTypeReservationFees: [
        { unitType: 'standard', amount: 1000 },
        { unitType: 'standard', amount: 2000 },
      ],
    })
    const res = await putSettings(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/settings/public', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('returns a portal-safe subset without auth', async () => {
    const res = await getPublicSettings()
    const json = await readJson<{ success: boolean; data: any }>(res)
    expect(json.success).toBe(true)
    // Keys exposed
    for (const k of ['facilityName', 'facilityPhone', 'accessHoursStart', 'accessHoursEnd',
      'customersCanScheduleMoveOuts', 'unitTypeReservationFees', 'customerFormFields']) {
      expect(json.data).toHaveProperty(k)
    }
    // Sensitive keys NOT exposed
    for (const k of ['gateApiKey', 'gateApiEndpoint', 'lateFeeAmount', 'nsfFeeAmount']) {
      expect(json.data).not.toHaveProperty(k)
    }
  })

  it('uses the stored facility name when set', async () => {
    await Settings.create({ facilityName: 'My Custom Facility' })
    const res = await getPublicSettings()
    const json = await readJson<{ data: any }>(res)
    expect(json.data.facilityName).toBe('My Custom Facility')
  })
})
