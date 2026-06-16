import { describe, it, expect, vi } from 'vitest'
import { balanceDelta, nextBalanceAfter, priorBalanceAfter, recordCharge, type PaymentBalanceInput } from './paymentBalance'

// Mock just enough of the Mongoose query chain priorBalanceAfter walks:
// findOne().sort().select().session().lean()
function mockPaymentModel(prior?: number) {
  return {
    findOne: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(prior === undefined ? null : { balanceAfter: prior }),
    }),
    create: vi.fn().mockResolvedValue([{ _id: 'pay-1' }]),
  } as any
}

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

describe('priorBalanceAfter', () => {
  it('returns 0 when the tenant has no rows yet', async () => {
    expect(await priorBalanceAfter(mockPaymentModel(undefined), 'tenant-1')).toBe(0)
  })

  it('returns the most recent balanceAfter snapshot', async () => {
    expect(await priorBalanceAfter(mockPaymentModel(4200), 'tenant-1')).toBe(4200)
  })

  it('passes the session through the query chain', async () => {
    const model = mockPaymentModel(100)
    const fakeSession = { id: 'sess' } as any
    await priorBalanceAfter(model, 'tenant-1', fakeSession)
    const chain = model.findOne.mock.results[0].value
    expect(chain.session).toHaveBeenCalledWith(fakeSession)
  })
})

describe('nextBalanceAfter', () => {
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

describe('recordCharge', () => {
  function mockTenantModel() {
    return { updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }) } as any
  }

  it('creates a charge row with the correct balanceAfter snapshot', async () => {
    const Payment = mockPaymentModel(2000) // tenant already owed $20
    const Tenant = mockTenantModel()
    const { balanceAfter } = await recordCharge(Payment, Tenant, {
      tenantId: 'tenant-1', amount: 2000, type: 'late_fee', stripePaymentIntentId: 'late_fee_x',
    })
    expect(balanceAfter).toBe(4000) // 2000 prior + 2000 charge
    const created = Payment.create.mock.calls[0][0][0]
    expect(created).toMatchObject({ direction: 'charge', status: 'pending', amount: 2000, type: 'late_fee', balanceAfter: 4000 })
  })

  it('increments tenant.balance by the charge amount (keeps the cache in sync)', async () => {
    const Payment = mockPaymentModel(0)
    const Tenant = mockTenantModel()
    await recordCharge(Payment, Tenant, {
      tenantId: 'tenant-1', amount: 1600, type: 'rent', stripePaymentIntentId: 'invoice_x',
    })
    expect(Tenant.updateOne).toHaveBeenCalledWith(
      { _id: 'tenant-1' },
      { $inc: { balance: 1600 } },
      {},
    )
  })

  it('defaults status to pending and threads a session to both writes', async () => {
    const Payment = mockPaymentModel(0)
    const Tenant = mockTenantModel()
    const session = { id: 'sess' } as any
    await recordCharge(Payment, Tenant, {
      tenantId: 'tenant-1', amount: 500, type: 'other', stripePaymentIntentId: 'fee_x', description: 'Cut Lock',
    }, session)
    expect(Payment.create.mock.calls[0][1]).toEqual({ session })
    expect(Tenant.updateOne.mock.calls[0][2]).toEqual({ session })
  })
})
