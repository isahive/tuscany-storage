import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'
import { makeRequest } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'
import Tenant from '@/models/Tenant'
import AccessLog from '@/models/AccessLog'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { getServerSession } from 'next-auth'
import { POST as updateGateCode } from '@/app/api/gate/route'

describe('POST /api/gate', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t') as never)
    const res = await updateGateCode(makeRequest('POST', '', {
      tenantId: 'x', newCode: '1234', reason: 'manual',
    }))
    expect(res.status).toBe(403)
  })

  it('rejects codes outside 4-6 digits', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await updateGateCode(makeRequest('POST', '', {
      tenantId: '507f1f77bcf86cd799439011', newCode: '12', reason: 'manual',
    }))
    expect(res.status).toBe(400)
  })

  it('rejects unknown reason enum values', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await updateGateCode(makeRequest('POST', '', {
      tenantId: '507f1f77bcf86cd799439011', newCode: '1234', reason: 'whatever',
    }))
    expect(res.status).toBe(400)
  })

  it('updates the tenant gate code and writes an AccessLog', async () => {
    const t = await makeTenant({ gateCode: '0000' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await updateGateCode(makeRequest('POST', '', {
      tenantId: t._id.toString(),
      newCode: '4242',
      reason: 'manual',
    }))
    expect(res.status).toBe(200)

    const updated = await Tenant.findById(t._id)
    expect(updated!.gateCode).toBe('4242')

    const log = await AccessLog.findOne({ tenantId: t._id })
    expect(log).not.toBeNull()
    expect(log!.eventType).toBe('code_changed')
    expect(log!.source).toBe('admin')
  })

  it('404s for an unknown tenantId', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await updateGateCode(makeRequest('POST', '', {
      tenantId: '507f1f77bcf86cd799439099',
      newCode: '1234',
      reason: 'manual',
    }))
    expect(res.status).toBe(404)
  })
})
