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
// PDF generation is slow + writes file bytes — stub it
vi.mock('@/lib/pdf', () => ({ generateLease: vi.fn(async () => Buffer.alloc(8)) }))

import { getServerSession } from 'next-auth'
import Lease from '@/models/Lease'
import { POST as signLease } from '@/app/api/leases/[id]/sign/route'

describe('POST /api/leases/[id]/sign', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb(); vi.mocked(getServerSession).mockReset() })
  afterAll(async () => { await stopTestDb() })

  it('401s without auth', async () => {
    const { lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await signLease(
      makeRequest('POST', '', { signatureData: 'data:image/png;base64,abc' }) as any,
      { params: Promise.resolve({ id: lease._id.toString() }) },
    )
    expect(res.status).toBe(401)
  })

  it('rejects empty signatureData', async () => {
    const { tenant, lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await signLease(
      makeRequest('POST', '', { signatureData: '' }) as any,
      { params: Promise.resolve({ id: lease._id.toString() }) },
    )
    expect(res.status).toBe(400)
  })

  it('404s on unknown lease id', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await signLease(
      makeRequest('POST', '', { signatureData: 'data:image/png;base64,abc' }) as any,
      { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) },
    )
    expect(res.status).toBe(404)
  })

  it('marks the lease signed for the owning tenant', async () => {
    const { tenant, lease } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await signLease(
      makeRequest('POST', '', { signatureData: 'data:image/png;base64,abc' }) as any,
      { params: Promise.resolve({ id: lease._id.toString() }) },
    )
    expect(res.status).toBe(200)
    const after = await Lease.findById(lease._id)
    expect(after!.signedAt).toBeInstanceOf(Date)
  })
})
