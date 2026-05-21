import { describe, it, expect, vi } from 'vitest'
import { balanceDelta, nextBalanceAfter, type PaymentBalanceInput } from './paymentBalance'

describe('balanceDelta', () => {
  const cases: Array<[PaymentBalanceInput, number, string]> = [
    [{ direction: 'charge',  status: 'pending',   amount: 5000 }, 5000,  'charges always add (even pending)'],
    [{ direction: 'charge',  status: 'succeeded', amount: 5000 }, 5000,  'succeeded charges still add'],
    [{ direction: 'charge',  status: 'voided',    amount: 5000 }, 5000,  'voided charge row counts — paired void payment offsets it'],
    [{ direction: 'payment', status: 'succeeded', amount: 5000 }, -5000, 'successful payments subtract'],
    [{ direction: 'payment', status: 'voided',    amount: 5000 }, -5000, 'voided payment rows subtract (offsetting the voided charge)'],
    [{ direction: 'payment', status: 'failed',    amount: 5000 }, 0,     'failed payments do not move balance'],
    [{ direction: 'payment', status: 'refunded',  amount: 5000 }, 0,     'refunded rows are informational only'],
  ]

  for (const [row, expected, label] of cases) {
    it(label, () => {
      expect(balanceDelta(row)).toBe(expected)
    })
  }
})

describe('nextBalanceAfter', () => {
  function mockPaymentModel(prior?: number) {
    return {
      findOne: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(prior === undefined ? null : { balanceAfter: prior }),
      }),
    } as any
  }

  it('starts from zero if there is no prior row', async () => {
    const Payment = mockPaymentModel(undefined)
    const out = await nextBalanceAfter(Payment, 'tenant-1', {
      direction: 'charge', status: 'pending', amount: 5000,
    })
    expect(out).toBe(5000)
  })

  it('adds delta on top of the prior balanceAfter', async () => {
    const Payment = mockPaymentModel(2000)
    const out = await nextBalanceAfter(Payment, 'tenant-1', {
      direction: 'payment', status: 'succeeded', amount: 1500,
    })
    expect(out).toBe(500)
  })

  it('honors a charge after a payment', async () => {
    const Payment = mockPaymentModel(-300) // had a credit
    const out = await nextBalanceAfter(Payment, 'tenant-1', {
      direction: 'charge', status: 'pending', amount: 1000,
    })
    expect(out).toBe(700)
  })
})
