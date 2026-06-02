import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => ({ user: { role: 'admin', email: 'a@x.com' } })),
}))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/reports/route'
import AccessLog from '@/models/AccessLog'
import VisitorAccess from '@/models/VisitorAccess'

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })
beforeEach(async () => { await clearTestDb() })

function makeReq(qs: string) {
  return new NextRequest(`http://localhost/api/reports?${qs}`)
}

describe('GET /api/reports?type=gate-activity', () => {
  it('returns tenant attribution with eventType, createdAt timestamp and gateId', async () => {
    const tenant = await makeTenant({ pdkHolderId: 'h-t1' })
    await AccessLog.create({
      tenantId: tenant._id,
      eventType: 'entry',
      gateId: 'entrance',
      source: 'keypad',
      notes: 'normal entry',
    })

    const res = await GET(makeReq('type=gate-activity'))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.rows).toHaveLength(1)
    const row = json.data.rows[0]
    expect(row.timestamp).toBeDefined()
    expect(row.who).toBe(`${tenant.firstName} ${tenant.lastName}`)
    expect(row.kind).toBe('Tenant')
    expect(row.event).toBe('entry')
    expect(row.gate).toBe('entrance')
    expect(row.source).toBe('keypad')
    expect(row.notes).toBe('normal entry')
  })

  it('returns visitor attribution with name + purpose, kind=Visitor', async () => {
    const visitor = await VisitorAccess.create({
      name: 'Bob Electrician',
      purpose: 'Outlet repair',
      validFrom: new Date(Date.now() - 60_000),
      validUntil: new Date(Date.now() + 60 * 60_000),
      pin: '424242',
      status: 'active',
      pdkHolderId: 'h-v1',
      createdBy: 'admin',
    })
    await AccessLog.create({
      visitorAccessId: visitor._id,
      eventType: 'entry',
      gateId: 'entrance',
      source: 'keypad',
    })

    const res = await GET(makeReq('type=gate-activity'))
    const json = await res.json()
    expect(json.data.rows).toHaveLength(1)
    const row = json.data.rows[0]
    expect(row.who).toBe('Bob Electrician (Outlet repair)')
    expect(row.kind).toBe('Visitor')
    expect(row.event).toBe('entry')
  })

  it('falls back to Unknown when neither principal can be resolved', async () => {
    // Orphan log — visitor was deleted but log row remains. Should not crash.
    await AccessLog.create({
      visitorAccessId: '64a0a0a0a0a0a0a0a0a0a0a0',
      eventType: 'denied',
      gateId: 'entrance',
      source: 'keypad',
    })
    const res = await GET(makeReq('type=gate-activity'))
    const json = await res.json()
    expect(json.data.rows).toHaveLength(1)
    expect(json.data.rows[0].who).toBe('Unknown')
    expect(json.data.rows[0].kind).toBe('—')
  })

  it('honors the createdAt date filter via from/to', async () => {
    const tenant = await makeTenant({ pdkHolderId: 'h-tf' })
    // Bypass mongoose timestamp auto-set so we can place this row in 2025.
    await AccessLog.collection.insertOne({
      tenantId: tenant._id,
      eventType: 'entry',
      gateId: 'entrance',
      source: 'keypad',
      createdAt: new Date('2025-01-01'),
    } as any)
    // New row — mongoose sets createdAt = now (mid-2026 per test setup).
    await AccessLog.create({
      tenantId: tenant._id,
      eventType: 'denied',
      gateId: 'entrance',
      source: 'keypad',
    })

    const res = await GET(makeReq('type=gate-activity&from=2026-06-01&to=2026-12-31'))
    const json = await res.json()
    expect(json.data.rows).toHaveLength(1)
    expect(json.data.rows[0].event).toBe('denied')
  })

  it('sorts by createdAt descending (most recent first)', async () => {
    const tenant = await makeTenant({ pdkHolderId: 'h-ts' })
    await AccessLog.collection.insertOne({
      tenantId: tenant._id,
      eventType: 'entry',
      gateId: 'entrance',
      source: 'keypad',
      notes: 'old',
      createdAt: new Date('2025-01-01'),
    } as any)
    await AccessLog.create({
      tenantId: tenant._id,
      eventType: 'entry',
      gateId: 'entrance',
      source: 'keypad',
      notes: 'recent',
    })

    const res = await GET(makeReq('type=gate-activity'))
    const json = await res.json()
    expect(json.data.rows[0].notes).toBe('recent')
    expect(json.data.rows[1].notes).toBe('old')
  })
})
