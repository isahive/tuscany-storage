import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'
import Tenant from '@/models/Tenant'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import { GET as getTenant, PATCH as patchTenant } from '@/app/api/tenants/[id]/route'

describe('GET /api/tenants/[id]', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('401s without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const t = await makeTenant()
    const res = await getTenant(makeRequest('GET', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(401)
  })

  it('lets a tenant see their own record', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t._id.toString()) as never)
    const res = await getTenant(makeRequest('GET', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(200)
  })

  it('forbids tenants from reading other tenants', async () => {
    const me = await makeTenant()
    const other = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(me._id.toString()) as never)
    const res = await getTenant(makeRequest('GET', '') as any, { params: Promise.resolve({ id: other._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('admin can read any tenant', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getTenant(makeRequest('GET', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(200)
  })

  it('404s on a missing id', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getTenant(makeRequest('GET', '') as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    expect(res.status).toBe(404)
  })

  it('returns internal notes to an admin', async () => {
    const t = await makeTenant({ notes: 'Daughters now own the unit.' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getTenant(makeRequest('GET', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    const json = await readJson<any>(res)
    expect(json.data.notes).toBe('Daughters now own the unit.')
  })

  it('strips internal notes for a tenant reading their own record', async () => {
    const t = await makeTenant({ notes: 'Daughters now own the unit.' })
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t._id.toString()) as never)
    const res = await getTenant(makeRequest('GET', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    const json = await readJson<any>(res)
    expect(json.data.notes).toBeUndefined()
  })
})

describe('PATCH /api/tenants/[id]', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('rejects invalid email format', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await patchTenant(
      makeRequest('PATCH', '', { email: 'not-an-email' }) as any,
      { params: Promise.resolve({ id: t._id.toString() }) },
    )
    expect(res.status).toBe(400)
  })

  it('updates allowed fields and persists', async () => {
    const t = await makeTenant({ firstName: 'Old', lastName: 'Name' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await patchTenant(
      makeRequest('PATCH', '', { firstName: 'New', lastName: 'Surname' }) as any,
      { params: Promise.resolve({ id: t._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.firstName).toBe('New')
    expect(json.data.lastName).toBe('Surname')
  })

  it('lets an admin write internal notes', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await patchTenant(
      makeRequest('PATCH', '', { notes: 'Cell phone is sister Amber.' }) as any,
      { params: Promise.resolve({ id: t._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.notes).toBe('Cell phone is sister Amber.')
  })

  it('ignores a tenant attempting to set their own internal notes', async () => {
    const t = await makeTenant({ notes: 'original admin memo' })
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t._id.toString()) as never)
    const res = await patchTenant(
      makeRequest('PATCH', '', { notes: 'tenant tried to overwrite' }) as any,
      { params: Promise.resolve({ id: t._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    // The admin memo is untouched and never echoed back to the tenant.
    expect(json.data.notes).toBeUndefined()
    const reread = await Tenant.findById(t._id).lean<{ notes?: string }>()
    expect(reread?.notes).toBe('original admin memo')
  })
})
