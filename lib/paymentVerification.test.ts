import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import PaymentVerification from '@/models/PaymentVerification'
import {
  getVerificationStatus,
  recordFailedPayment,
  recordSuccessfulPayment,
  recordScreenOpen,
  recordManualCharge,
  recordPaymentWithoutRental,
  tenantKey,
  adminKey,
} from './paymentVerification'

describe('paymentVerification', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  describe('key helpers', () => {
    it('tenantKey + adminKey produce namespaced keys', () => {
      expect(tenantKey('abc')).toBe('tenant:abc')
      expect(adminKey('xyz')).toBe('admin:xyz')
    })
  })

  describe('getVerificationStatus', () => {
    it('returns required:false when no record exists', async () => {
      expect(await getVerificationStatus(tenantKey('none'))).toEqual({ required: false })
    })

    it('returns required:false when the requirement has expired', async () => {
      await PaymentVerification.create({
        key: tenantKey('past'),
        verificationRequiredUntil: new Date(Date.now() - 1000),
        verificationReason: 'old',
      })
      expect(await getVerificationStatus(tenantKey('past'))).toEqual({ required: false })
    })

    it('returns the reason + expiry when still active', async () => {
      const future = new Date(Date.now() + 60_000)
      await PaymentVerification.create({
        key: tenantKey('active'),
        verificationRequiredUntil: future,
        verificationReason: '5 consecutive failed payments',
      })
      const status = await getVerificationStatus(tenantKey('active'))
      expect(status.required).toBe(true)
      expect(status.reason).toBe('5 consecutive failed payments')
    })
  })

  describe('recordFailedPayment', () => {
    it('trips at 5 consecutive failures', async () => {
      const key = tenantKey('fail')
      for (let i = 0; i < 4; i++) {
        await recordFailedPayment(key)
        expect((await getVerificationStatus(key)).required).toBe(false)
      }
      await recordFailedPayment(key)
      const after = await getVerificationStatus(key)
      expect(after.required).toBe(true)
      expect(after.reason).toMatch(/5 consecutive/)
    })

    it('recordSuccessfulPayment clears the streak + requirement', async () => {
      const key = tenantKey('reset')
      for (let i = 0; i < 5; i++) await recordFailedPayment(key)
      expect((await getVerificationStatus(key)).required).toBe(true)

      await recordSuccessfulPayment(key)
      expect((await getVerificationStatus(key)).required).toBe(false)
    })
  })

  describe('recordScreenOpen', () => {
    it('trips at 5 screen opens without a success', async () => {
      const key = tenantKey('screen')
      for (let i = 0; i < 5; i++) await recordScreenOpen(key)
      const status = await getVerificationStatus(key)
      expect(status.required).toBe(true)
      expect(status.reason).toMatch(/Payment screen opened/i)
    })
  })

  describe('recordManualCharge', () => {
    it('trips once admin exceeds 3 manual charges in an hour', async () => {
      const key = adminKey('a1')
      expect((await recordManualCharge(key)).tripped).toBe(false)
      expect((await recordManualCharge(key)).tripped).toBe(false)
      expect((await recordManualCharge(key)).tripped).toBe(false)
      // 4th in the same hour trips
      const fourth = await recordManualCharge(key)
      expect(fourth.tripped).toBe(true)
      expect((await getVerificationStatus(key)).required).toBe(true)
    })
  })

  describe('recordPaymentWithoutRental', () => {
    it('immediately requires verification', async () => {
      const key = adminKey('walk-in')
      await recordPaymentWithoutRental(key)
      const status = await getVerificationStatus(key)
      expect(status.required).toBe(true)
      expect(status.reason).toMatch(/without an active rental/i)
    })
  })
})
