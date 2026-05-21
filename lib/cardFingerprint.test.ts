import { describe, it, expect, vi, beforeEach } from 'vitest'

const retrieveMock = vi.fn()
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentMethods: { retrieve: retrieveMock } },
}))

import { syncCardFingerprint } from './cardFingerprint'

describe('syncCardFingerprint', () => {
  beforeEach(() => {
    retrieveMock.mockReset()
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('clears fingerprint when no defaultPaymentMethodId is set', async () => {
    const tenant: { defaultPaymentMethodId?: string | null; cardFingerprint?: string } = {
      defaultPaymentMethodId: null,
      cardFingerprint: 'fp_old',
    }
    await syncCardFingerprint(tenant)
    expect(tenant.cardFingerprint).toBeUndefined()
    expect(retrieveMock).not.toHaveBeenCalled()
  })

  it('no-ops without a Stripe secret key (skip in environments without billing)', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const tenant = { defaultPaymentMethodId: 'pm_1', cardFingerprint: 'fp_old' }
    await syncCardFingerprint(tenant)
    expect(tenant.cardFingerprint).toBe('fp_old')
    expect(retrieveMock).not.toHaveBeenCalled()
  })

  it('writes the Stripe-reported fingerprint into the tenant doc', async () => {
    retrieveMock.mockResolvedValueOnce({ card: { fingerprint: 'fp_new_abc' } })
    const tenant: { defaultPaymentMethodId?: string; cardFingerprint?: string } = {
      defaultPaymentMethodId: 'pm_1',
    }
    await syncCardFingerprint(tenant)
    expect(tenant.cardFingerprint).toBe('fp_new_abc')
    expect(retrieveMock).toHaveBeenCalledWith('pm_1')
  })

  it('handles a payment method with no card object (ACH, link, etc.)', async () => {
    retrieveMock.mockResolvedValueOnce({})
    const tenant: { defaultPaymentMethodId?: string; cardFingerprint?: string } = {
      defaultPaymentMethodId: 'pm_ach',
    }
    await syncCardFingerprint(tenant)
    expect(tenant.cardFingerprint).toBeUndefined()
  })

  it('swallows Stripe errors silently — best-effort cache', async () => {
    retrieveMock.mockRejectedValueOnce(new Error('Stripe 500'))
    const tenant = { defaultPaymentMethodId: 'pm_1', cardFingerprint: 'fp_old' }
    await expect(syncCardFingerprint(tenant)).resolves.toBeUndefined()
    // existing fingerprint left intact when Stripe fails
    expect(tenant.cardFingerprint).toBe('fp_old')
  })
})
