import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'
import Payment from '@/models/Payment'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

// Stripe webhook constructEvent is what validates the signature. Mock the
// whole stripe module so we control what event the handler "receives" without
// touching the signature crypto.
const { constructEventMock } = vi.hoisted(() => ({ constructEventMock: vi.fn() }))
vi.mock('stripe', () => {
  class FakeStripe {
    webhooks = { constructEvent: constructEventMock }
  }
  return { default: FakeStripe }
})

import { POST as stripeWebhook } from '@/app/api/webhooks/stripe/route'

function signedRequest(body: string) {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig-abc' },
    body,
  })
}

describe('POST /api/webhooks/stripe', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    constructEventMock.mockReset()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })
  afterAll(async () => { await stopTestDb() })

  it('400s when the stripe-signature header is missing', async () => {
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    })
    const res = await stripeWebhook(req as any)
    expect(res.status).toBe(400)
  })

  it('500s when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await stripeWebhook(signedRequest('{}') as any)
    expect(res.status).toBe(500)
  })

  it('400s when stripe.webhooks.constructEvent throws (bad signature)', async () => {
    constructEventMock.mockImplementationOnce(() => { throw new Error('No signatures found') })
    const res = await stripeWebhook(signedRequest('{}') as any)
    expect(res.status).toBe(400)
  })

  it('on payment_intent.succeeded, flips the matching Payment to succeeded', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    const piId = `pi_test_${Date.now()}`
    const row = await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      type: 'rent', direction: 'payment', status: 'pending', amount: 10000,
      currency: 'usd', stripePaymentIntentId: piId,
    })

    constructEventMock.mockReturnValueOnce({
      type: 'payment_intent.succeeded',
      data: { object: { id: piId, latest_charge: 'ch_x', metadata: {} } },
    })
    const res = await stripeWebhook(signedRequest('{}') as any)
    expect(res.status).toBe(200)

    const after = await Payment.findById(row._id)
    expect(after!.status).toBe('succeeded')
    expect(after!.stripeChargeId).toBe('ch_x')
  })

  it('on payment_intent.payment_failed, flips matching Payment to failed', async () => {
    const { tenant, lease, unit } = await makeRentedTenant()
    const piId = `pi_test_fail_${Date.now()}`
    const row = await Payment.create({
      tenantId: tenant._id, leaseId: lease._id, unitId: unit._id,
      type: 'rent', direction: 'payment', status: 'pending', amount: 10000,
      currency: 'usd', stripePaymentIntentId: piId,
    })

    constructEventMock.mockReturnValueOnce({
      type: 'payment_intent.payment_failed',
      data: { object: { id: piId, last_payment_error: { message: 'Insufficient funds' } } },
    })
    const res = await stripeWebhook(signedRequest('{}') as any)
    expect(res.status).toBe(200)

    const after = await Payment.findById(row._id)
    expect(after!.status).toBe('failed')
    expect(after!.failureReason).toMatch(/Insufficient/i)
  })

  it('returns 200 for events we do not handle', async () => {
    constructEventMock.mockReturnValueOnce({
      type: 'invoice.paid',
      data: { object: {} },
    })
    const res = await stripeWebhook(signedRequest('{}') as any)
    expect(res.status).toBe(200)
  })
})
