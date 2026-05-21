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
import { GET as getNotes, POST as postNote } from '@/app/api/tenants/[id]/notes/route'

describe('GET /api/tenants/[id]/notes', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t._id.toString()) as never)
    const res = await getNotes(makeRequest('GET', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('returns the tenant\'s notes newest first', async () => {
    const t = await makeTenant()
    // Add two notes via POST
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    await postNote(makeRequest('POST', '', { content: 'first' }) as any, { params: Promise.resolve({ id: t._id.toString() }) })
    await new Promise((r) => setTimeout(r, 10))
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    await postNote(makeRequest('POST', '', { content: 'second' }) as any, { params: Promise.resolve({ id: t._id.toString() }) })

    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getNotes(makeRequest('GET', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    const json = await readJson<any>(res)
    expect(json.data).toHaveLength(2)
    expect(json.data[0].content).toBe('second')
    expect(json.data[1].content).toBe('first')
  })
})

describe('POST /api/tenants/[id]/notes', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t._id.toString()) as never)
    const res = await postNote(makeRequest('POST', '', { content: 'note' }) as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('rejects empty content', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await postNote(makeRequest('POST', '', { content: '' }) as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(400)
  })

  it('persists a note with attachment metadata', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await postNote(
      makeRequest('POST', '', {
        content: 'with attachment',
        attachmentUrl: 'https://r2.example.com/file.pdf',
        attachmentName: 'file.pdf',
      }) as any,
      { params: Promise.resolve({ id: t._id.toString() }) },
    )
    expect([200, 201]).toContain(res.status)
    const json = await readJson<any>(res)
    expect(json.data.content).toBe('with attachment')
    expect(json.data.attachmentUrl).toBe('https://r2.example.com/file.pdf')
    expect(json.data.attachmentName).toBe('file.pdf')
  })
})
