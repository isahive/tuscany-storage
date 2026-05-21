import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'
import { makeRequest } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

const { sendTemplatedMock } = vi.hoisted(() => ({
  sendTemplatedMock: vi.fn(async () => undefined),
}))
vi.mock('@/lib/sendNotification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sendNotification')>('@/lib/sendNotification')
  return { ...actual, sendTemplatedNotification: sendTemplatedMock }
})

import { getServerSession } from 'next-auth'
import { POST as sendAgreement } from '@/app/api/admin/leases/[id]/send-agreement/route'

describe('POST /api/admin/leases/[id]/send-agreement', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    sendTemplatedMock.mockClear()
  })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const { lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await sendAgreement(makeRequest('POST', '') as any, { params: Promise.resolve({ id: lease._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('404s when lease is unknown', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await sendAgreement(makeRequest('POST', '') as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    expect(res.status).toBe(404)
  })

  it('dispatches the "Storage Agreement" template', async () => {
    const { lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await sendAgreement(makeRequest('POST', '') as any, { params: Promise.resolve({ id: lease._id.toString() }) })
    expect(res.status).toBe(200)
    expect(sendTemplatedMock).toHaveBeenCalledWith(expect.objectContaining({
      templateName: 'Storage Agreement',
    }))
  })
})
