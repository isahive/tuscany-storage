import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import { GET as listTenants, POST as createTenant } from '@/app/api/tenants/route'

describe('GET /api/tenants', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('rejects unauthenticated callers', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await listTenants(makeRequest('GET', '/api/tenants') as any)
    expect(res.status).toBe(401)
  })

  it('returns all tenants for an admin', async () => {
    await makeTenant({ firstName: 'A' })
    await makeTenant({ firstName: 'B' })
    await makeTenant({ firstName: 'C' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await listTenants(makeRequest('GET', '/api/tenants?limit=10') as any)
    const json = await readJson<any>(res)
    expect(json.success).toBe(true)
    expect(json.data.total).toBe(3)
    expect(json.data.items).toHaveLength(3)
  })

  it('restricts non-admin tenants to only their own record', async () => {
    const me = await makeTenant({ firstName: 'Me' })
    await makeTenant({ firstName: 'Other' })
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(me._id.toString()) as never)
    const res = await listTenants(makeRequest('GET', '/api/tenants') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(1)
    expect(json.data.items[0]._id.toString()).toBe(me._id.toString())
  })

  it('applies the search filter on first/last/email/phone (case-insensitive)', async () => {
    await makeTenant({ firstName: 'Ada', lastName: 'Lovelace' })
    await makeTenant({ firstName: 'Grace', lastName: 'Hopper' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await listTenants(makeRequest('GET', '/api/tenants?search=hop') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(1)
    expect(json.data.items[0].lastName).toBe('Hopper')
  })

  it('applies a status filter', async () => {
    await makeTenant({ status: 'active' })
    await makeTenant({ status: 'delinquent' })
    await makeTenant({ status: 'delinquent' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await listTenants(makeRequest('GET', '/api/tenants?status=delinquent') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(2)
  })

  it('hides archived accounts from the default view', async () => {
    await makeTenant({ firstName: 'Active' })
    await makeTenant({ firstName: 'Gone', archived: true })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await listTenants(makeRequest('GET', '/api/tenants?limit=10') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(1)
    expect(json.data.items[0].firstName).toBe('Active')
  })

  it('shows only archived accounts under the Archived group', async () => {
    await makeTenant({ firstName: 'Active' })
    await makeTenant({ firstName: 'Gone', archived: true })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await listTenants(makeRequest('GET', '/api/tenants?group=archived&limit=10') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(1)
    expect(json.data.items[0].firstName).toBe('Gone')
  })

  it('escapes regex metacharacters in search', async () => {
    await makeTenant({ firstName: 'Normal' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    // .* would otherwise match everything if not escaped
    const res = await listTenants(makeRequest('GET', '/api/tenants?search=.%2A') as any)
    const json = await readJson<any>(res)
    expect(json.data.total).toBe(0)
  })
})

describe('POST /api/tenants', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('rejects invalid payloads via zod', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const req = makeRequest('POST', '/api/tenants', {
      firstName: '', lastName: 'X', email: 'not-an-email', phone: '555', password: 'x',
    })
    const res = await createTenant(req)
    expect(res.status).toBe(400)
  })
})
