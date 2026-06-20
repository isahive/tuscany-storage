import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { Types } from 'mongoose'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { withTxn } from './withTxn'
import Payment from '@/models/Payment'

// The in-memory test server is a standalone mongod, which can't run
// transactions — so these exercise withTxn's graceful fallback path: the unit
// of work still executes (once) and persists, without a session.
describe('withTxn (standalone fallback)', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('runs the unit of work and persists writes', async () => {
    const tenantId = new Types.ObjectId()

    const row = await withTxn(async (session) => {
      const [created] = await Payment.create([{
        tenantId, amount: 5000, type: 'rent', direction: 'charge',
        status: 'pending', balanceAfter: 5000,
      }], { session })
      return created
    })

    expect(row).toBeTruthy()
    const found = await Payment.findById(row._id)
    expect(found!.amount).toBe(5000)
  })

  it('applies the write exactly once (no duplicate from the fallback)', async () => {
    const tenantId = new Types.ObjectId()

    await withTxn(async (session) => {
      await Payment.create([{
        tenantId, amount: 1000, type: 'rent', direction: 'charge',
        status: 'pending', balanceAfter: 1000,
      }], { session })
    })

    expect(await Payment.countDocuments({ tenantId })).toBe(1)
  })

  it('propagates real errors from the callback', async () => {
    await expect(
      withTxn(async () => { throw new Error('kaboom') }),
    ).rejects.toThrow('kaboom')
  })
})
