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
import { GET as listTemplates, POST as createTemplate } from '@/app/api/admin/templates/route'

describe('GET /api/admin/templates', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await listTemplates()
    expect(res.status).toBe(403)
  })

  it('seeds default templates on first call and returns them', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await listTemplates()
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.length).toBeGreaterThan(5)
    // "Move Out Receipt" is one of the seeded defaults
    expect(json.data.find((t: any) => t.name === 'Move Out Receipt')).toBeDefined()
  })

  it('returns defaults before customs', async () => {
    await NotificationTemplate.create({
      name: 'Custom Test',
      type: 'custom',
      emailSubject: 'x',
      emailContent: 'x',
      textContent: 'x',
      emailEnabled: true,
      textEnabled: false,
      active: true,
    })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await listTemplates()
    const json = await readJson<any>(res)
    const defaultIdx = json.data.findIndex((t: any) => t.type === 'default')
    const customIdx = json.data.findIndex((t: any) => t.type === 'custom')
    expect(defaultIdx).toBeGreaterThanOrEqual(0)
    expect(customIdx).toBeGreaterThan(defaultIdx)
  })

  it('does NOT overwrite existing default templates that admins customized', async () => {
    await NotificationTemplate.create({
      name: 'Move Out Receipt',
      type: 'default',
      emailSubject: 'CUSTOM SUBJECT',
      emailContent: 'CUSTOM BODY',
      textContent: 'sms',
      emailEnabled: true,
      textEnabled: false,
      active: true,
    })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    await listTemplates()
    const stored = await NotificationTemplate.findOne({ name: 'Move Out Receipt' })
    expect(stored?.emailSubject).toBe('CUSTOM SUBJECT')
  })
})

describe('POST /api/admin/templates', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await createTemplate(makeRequest('POST', '/api/admin/templates', { name: 'X', emailSubject: 's', emailContent: 'b' }))
    expect(res.status).toBe(403)
  })
})
