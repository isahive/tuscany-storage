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
import NotificationTemplate from '@/models/NotificationTemplate'
import { GET as getTemplate, PUT as putTemplate, DELETE as deleteTemplate } from '@/app/api/admin/templates/[id]/route'

async function makeTpl(over: Record<string, unknown> = {}) {
  return NotificationTemplate.create({
    name: 'Custom Tpl',
    type: 'custom',
    emailSubject: 'Hi',
    emailContent: 'Body',
    textContent: 'sms',
    emailEnabled: true,
    textEnabled: false,
    active: true,
    ...over,
  })
}

describe('GET /api/admin/templates/[id]', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const tpl = await makeTpl()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await getTemplate(makeRequest('GET', '') as any, { params: { id: tpl._id.toString() } })
    expect(res.status).toBe(403)
  })

  it('404s on unknown id', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getTemplate(makeRequest('GET', '') as any, { params: { id: '507f1f77bcf86cd799439099' } })
    expect(res.status).toBe(404)
  })

  it('returns the template', async () => {
    const tpl = await makeTpl()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await getTemplate(makeRequest('GET', '') as any, { params: { id: tpl._id.toString() } })
    const json = await readJson<any>(res)
    expect(json.data.name).toBe('Custom Tpl')
  })
})

describe('PUT /api/admin/templates/[id]', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const tpl = await makeTpl()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await putTemplate(makeRequest('PUT', '', { emailSubject: 'New' }) as any, { params: { id: tpl._id.toString() } })
    expect(res.status).toBe(403)
  })

  it('updates the template content', async () => {
    const tpl = await makeTpl({ emailSubject: 'Old' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await putTemplate(
      makeRequest('PUT', '', { emailSubject: 'Updated subject', emailContent: '<p>New</p>' }) as any,
      { params: { id: tpl._id.toString() } },
    )
    expect(res.status).toBe(200)
    const after = await NotificationTemplate.findById(tpl._id)
    expect(after!.emailSubject).toBe('Updated subject')
  })

  it('404s on unknown id', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await putTemplate(
      makeRequest('PUT', '', { emailSubject: 'x' }) as any,
      { params: { id: '507f1f77bcf86cd799439099' } },
    )
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/admin/templates/[id]', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const tpl = await makeTpl()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await deleteTemplate(makeRequest('DELETE', '') as any, { params: { id: tpl._id.toString() } })
    expect(res.status).toBe(403)
  })

  it('refuses to delete default templates', async () => {
    const tpl = await makeTpl({ type: 'default', name: 'Move Out Receipt' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await deleteTemplate(makeRequest('DELETE', '') as any, { params: { id: tpl._id.toString() } })
    expect([400, 403, 409]).toContain(res.status)
  })

  it('deletes a custom template', async () => {
    const tpl = await makeTpl({ type: 'custom' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await deleteTemplate(makeRequest('DELETE', '') as any, { params: { id: tpl._id.toString() } })
    expect(res.status).toBe(200)
    expect(await NotificationTemplate.findById(tpl._id)).toBeNull()
  })
})
