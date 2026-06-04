/**
 * Coverage for the ACH paths added to portal self-pay and public reserve.
 * Card paths are exercised in adjacent files; this file focuses on the
 * paymentMethodType branching, status handling, and ledger row shapes that
 * the ACH flow introduced.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { Types } from 'mongoose'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant, makeUnit } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

// Bypass real Stripe signature verification — the webhook still checks for
// the signature header + secret, but the constructEvent step is mocked so we
// can drive the event payload from the test directly.
const { constructEventMock } = vi.hoisted(() => ({ constructEventMock: vi.fn() }))
vi.mock('stripe', () => ({
  default: class StripeMock {
    webhooks = { constructEvent: constructEventMock }
  },
}))

import { getServerSession } from 'next-auth'
import Payment from '@/models/Payment'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Settings from '@/models/Settings'
import Unit from '@/models/Unit'
import { POST as payMultiIntent } from '@/app/api/portal/pay-multi/intent/route'
import { POST as payMulti } from '@/app/api/portal/pay-multi/route'
import { POST as publicReserve } from '@/app/api/public/reserve/route'
import { POST as reserveFinalize } from '@/app/api/public/reserve/finalize/route'
import { POST as stripeWebhook } from '@/app/api/webhooks/stripe/route'

describe('POST /api/portal/pay-multi/intent — ACH', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  it('accepts paymentMethodType=ach and returns devMode secret', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await payMultiIntent(makeRequest('POST', '', {
      amount: 5000,
      paymentMethodType: 'ach',
    }))
    expect(res.status).toBe(200)
    const json = await readJson<any>(res)
    expect(json.data.devMode).toBe(true)
  })

  it('rejects unknown paymentMethodType', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await payMultiIntent(makeRequest('POST', '', {
      amount: 5000,
      paymentMethodType: 'crypto',
    }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/portal/pay-multi — ACH description', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  it('labels the Payment row as ACH when paymentMethodType=ach', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await payMulti(makeRequest('POST', '', {
      amount: 1000,
      paymentMethodType: 'ach',
    }) as any)
    expect(res.status).toBe(200)
    const row = await Payment.findOne({ tenantId: tenant._id, direction: 'payment' })
    expect(row).toBeTruthy()
    expect(row!.description).toContain('One Time ACH')
  })

  it('defaults to card when paymentMethodType is omitted', async () => {
    const { tenant } = await makeRentedTenant()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession(tenant._id.toString()) as never)
    const res = await payMulti(makeRequest('POST', '', { amount: 1000 }) as any)
    expect(res.status).toBe(200)
    const row = await Payment.findOne({ tenantId: tenant._id, direction: 'payment' })
    expect(row!.description).toContain('One Time Credit Card')
  })
})

describe('POST /api/public/reserve — ACH branch', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  it('accepts paymentMethodType=ach without error', async () => {
    const unit = await makeUnit({ status: 'available' })
    await Settings.create({})
    const res = await publicReserve(makeRequest('POST', '', {
      unitId: unit._id.toString(),
      paymentMethodType: 'ach',
      firstName: 'Achuser',
      lastName: 'Tester',
      email: 'ach@example.com',
      phone: '5125551234',
      password: 'longenoughpw',
    }))
    expect(res.status).toBe(201)
    const json = await readJson<any>(res)
    expect(json.success).toBe(true)
    expect(json.data.leaseId).toBeTruthy()
  })

  it('rejects unknown paymentMethodType', async () => {
    const unit = await makeUnit({ status: 'available' })
    const res = await publicReserve(makeRequest('POST', '', {
      unitId: unit._id.toString(),
      paymentMethodType: 'crypto',
      firstName: 'X', lastName: 'Y', email: 'x@example.com',
      phone: '5125551234', password: 'longenoughpw',
    }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/public/reserve/finalize — ACH ledger', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    delete process.env.STRIPE_SECRET_KEY
  })
  afterAll(async () => { await stopTestDb() })

  async function setupReserveLease(): Promise<{ leaseId: string; tenantId: Types.ObjectId; unit: any }> {
    const unit = await Unit.create({
      unitNumber: 'U900',
      size: '10x10',
      width: 10, depth: 10, sqft: 100, floor: 'ground',
      type: 'standard',
      price: 8000,
      monthlyRate: 8000,
      status: 'available',
    })
    const tenant = await Tenant.create({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com',
      phone: '5125551234', password: 'hashed', role: 'tenant', status: 'active',
    })
    const lease = await Lease.create({
      tenantId: tenant._id,
      unitId: unit._id,
      startDate: new Date(),
      monthlyRate: 8000,
      deposit: 8000,
      billingDay: 1,
      status: 'active',
    })
    await Settings.create({})
    return { leaseId: lease._id.toString(), tenantId: tenant._id, unit }
  }

  it('creates charges + payment row as PENDING when paymentMethodType=ach', async () => {
    const { leaseId, tenantId } = await setupReserveLease()
    const res = await reserveFinalize(makeRequest('POST', '', {
      leaseId,
      paymentMethodType: 'ach',
      signatureData: 'data:image/png;base64,aaa',
      signatureType: 'drawn',
    }))
    expect(res.status).toBe(200)

    const charges = await Payment.find({ tenantId, direction: 'charge' })
    expect(charges.length).toBeGreaterThan(0)
    for (const c of charges) expect(c.status).toBe('pending')

    const paymentRow = await Payment.findOne({ tenantId, direction: 'payment' })
    expect(paymentRow!.status).toBe('pending')
    expect(paymentRow!.description).toContain('ACH')
    expect(paymentRow!.description).toContain('Pending')
    expect((paymentRow!.appliedToItemIds ?? []).length).toBe(charges.length)
  })

  it('creates charges + payment row as SUCCEEDED for card path (default)', async () => {
    const { leaseId, tenantId } = await setupReserveLease()
    const res = await reserveFinalize(makeRequest('POST', '', {
      leaseId,
      signatureData: 'data:image/png;base64,aaa',
      signatureType: 'drawn',
    }))
    expect(res.status).toBe(200)
    const charges = await Payment.find({ tenantId, direction: 'charge' })
    for (const c of charges) expect(c.status).toBe('succeeded')
    const paymentRow = await Payment.findOne({ tenantId, direction: 'payment' })
    expect(paymentRow!.status).toBe('succeeded')
    expect(paymentRow!.description).toContain('Credit Card')
  })
})

describe('POST /api/webhooks/stripe — falls back to payment.appliedToItemIds when metadata absent', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    constructEventMock.mockReset()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })
  afterAll(async () => { await stopTestDb() })

  function signedRequest(body: string) {
    return new Request('http://localhost/wh', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig-abc', 'content-type': 'application/json' },
      body,
    })
  }

  it('flips pending charges to succeeded for ACH reserve flow (no metadata.itemIds)', async () => {
    const { tenant } = await makeRentedTenant()
    const charge = await Payment.create({
      tenantId: tenant._id,
      amount: 8000,
      type: 'rent',
      status: 'pending',
      direction: 'charge',
      balanceAfter: 8000,
    })
    const paymentRow = await Payment.create({
      tenantId: tenant._id,
      amount: 8000,
      type: 'rent',
      status: 'pending',
      direction: 'payment',
      balanceAfter: 0,
      stripePaymentIntentId: 'pi_test_ach_xxx',
      appliedToItemIds: [charge._id],
    })

    constructEventMock.mockReturnValueOnce({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_ach_xxx',
          latest_charge: 'ch_test_xxx',
          metadata: {},
        },
      },
    })

    const res = await stripeWebhook(signedRequest('{}') as any)
    expect(res.status).toBe(200)

    const flipped = await Payment.findById(charge._id)
    expect(flipped!.status).toBe('succeeded')
    const settled = await Payment.findById(paymentRow._id)
    expect(settled!.status).toBe('succeeded')
    void Tenant
  })

  it('still prefers metadata.itemIds when present (admin/portal apply-payment path)', async () => {
    const { tenant } = await makeRentedTenant()
    const charge = await Payment.create({
      tenantId: tenant._id,
      amount: 5000,
      type: 'rent',
      status: 'pending',
      direction: 'charge',
      balanceAfter: 5000,
    })
    const paymentRow = await Payment.create({
      tenantId: tenant._id,
      amount: 5000,
      type: 'rent',
      status: 'pending',
      direction: 'payment',
      balanceAfter: 0,
      stripePaymentIntentId: 'pi_test_card_xxx',
      // No appliedToItemIds — apply-payment uses metadata instead.
    })

    constructEventMock.mockReturnValueOnce({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_card_xxx',
          latest_charge: 'ch_test_yyy',
          metadata: { itemIds: charge._id.toString() },
        },
      },
    })

    const res = await stripeWebhook(signedRequest('{}') as any)
    expect(res.status).toBe(200)
    const flipped = await Payment.findById(charge._id)
    expect(flipped!.status).toBe('succeeded')
    void paymentRow
  })
})
