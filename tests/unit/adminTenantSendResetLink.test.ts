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

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(async () => 'resend-id-1'),
}))
vi.mock('@/lib/email', () => ({
  sendEmail: sendEmailMock,
  sendAdminNotification: vi.fn(async () => undefined),
}))

import { getServerSession } from 'next-auth'
import PasswordResetToken from '@/models/PasswordResetToken'
import { POST as sendResetLink } from '@/app/api/admin/tenants/[id]/send-reset-link/route'

describe('POST /api/admin/tenants/[id]/send-reset-link', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    sendEmailMock.mockClear()
  })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await sendResetLink(makeRequest('POST', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('404s when tenant id is unknown', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await sendResetLink(makeRequest('POST', '') as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    expect(res.status).toBe(404)
  })

  it('creates a token (issuedBy = admin id) + emails + returns url', async () => {
    const t = await makeTenant({ email: 'admin-reset@x.com' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession('admin-1') as never)
    const res = await sendResetLink(makeRequest('POST', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.url).toMatch(/reset-password.*token=/)
    expect(json.data.emailed).toBe(true)

    const tokens = await PasswordResetToken.find({ tenantId: t._id })
    expect(tokens).toHaveLength(1)
    expect(tokens[0].issuedBy).toBe('admin-1')
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })

  it('returns emailed:false when email delivery fails (still issues token)', async () => {
    sendEmailMock.mockImplementationOnce(async () => { throw new Error('Resend down') })
    const t = await makeTenant({ email: 'fail@x.com' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await sendResetLink(makeRequest('POST', '') as any, { params: Promise.resolve({ id: t._id.toString() }) })
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.emailed).toBe(false)
    expect(json.data.emailError).toMatch(/Resend down/)
    expect(await PasswordResetToken.countDocuments({ tenantId: t._id })).toBe(1)
  })
})
