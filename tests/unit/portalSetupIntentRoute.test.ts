import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'
import { readJson } from '@/tests/helpers/request'
import { tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

const { customersCreateMock, setupIntentsCreateMock } = vi.hoisted(() => ({
  customersCreateMock: vi.fn(async () => ({ id: 'cus_new_xyz' })),
  setupIntentsCreateMock: vi.fn(async () => ({ id: 'seti_x', client_secret: 'seti_x_secret' })),
}))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { create: customersCreateMock },
    setupIntents: { create: setupIntentsCreateMock },
  },
}))

import { getServerSession } from 'next-auth'
import Tenant from '@/models/Tenant'
import { POST as createSetupIntent } from '@/app/api/portal/setup-intent/route'

describe('POST /api/portal/setup-intent', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    customersCreateMock.mockClear()
    setupIntentsCreateMock.mockClear()
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })
  afterAll(async () => { await stopTestDb() })

  it('401s without auth', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as never)
    const res = await createSetupIntent()
    expect(res.status).toBe(401)
  })

  it('503s when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const t = await makeTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t._id.toString()) as never)
    const res = await createSetupIntent()
    expect(res.status).toBe(503)
  })

  it('lazy-creates a Stripe customer when one does not exist + returns client_secret', async () => {
    const t = await makeTenant({ email: 'pm@x.com' })
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t._id.toString()) as never)
    const res = await createSetupIntent()
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.clientSecret).toBe('seti_x_secret')
    expect(customersCreateMock).toHaveBeenCalledTimes(1)
    expect(setupIntentsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ usage: 'off_session', payment_method_types: ['card'] }),
    )

    const updated = await Tenant.findById(t._id).select('+stripeCustomerId')
    expect(updated!.stripeCustomerId).toBe('cus_new_xyz')
  })

  it('reuses an existing Stripe customer without creating a new one', async () => {
    const t = await makeTenant({ stripeCustomerId: 'cus_existing' })
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(t._id.toString()) as never)
    const res = await createSetupIntent()
    expect(res.status).toBe(200)
    expect(customersCreateMock).not.toHaveBeenCalled()
    expect(setupIntentsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' }),
    )
  })

  it('404s when the session points at a missing tenant', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('507f1f77bcf86cd799439099') as never)
    const res = await createSetupIntent()
    expect(res.status).toBe(404)
  })
})
