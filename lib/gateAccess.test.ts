import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { Types } from 'mongoose'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'
import Tenant from '@/models/Tenant'
import AccessLog from '@/models/AccessLog'
import { revokeGateAccess } from './gateAccess'

describe('revokeGateAccess', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('clears gateCode, additionalCards, gateGroups + stamps lockedOutAt', async () => {
    const t = await makeTenant({
      gateCode: '1234',
      additionalCards: ['CARD-A', 'CARD-B'],
      gateGroups: ['GROUP-1'],
    })

    await revokeGateAccess(t._id, 'move_out')

    const after = await Tenant.findById(t._id)
    expect(after!.gateCode).toBeUndefined()
    expect(after!.additionalCards ?? []).toEqual([])
    expect(after!.gateGroups ?? []).toEqual([])
    expect(after!.lockedOutAt).toBeInstanceOf(Date)
  })

  it('writes an AccessLog row tagged with the reason and unit', async () => {
    const t = await makeTenant()
    const unitId = new Types.ObjectId()
    await revokeGateAccess(t._id, 'auction', unitId)

    const logs = await AccessLog.find({ tenantId: t._id })
    expect(logs).toHaveLength(1)
    expect(logs[0].eventType).toBe('code_changed')
    expect(logs[0].source).toBe('system')
    expect(logs[0].notes).toMatch(/auction/i)
    expect(String(logs[0].unitId)).toBe(String(unitId))
  })

  it('accepts every documented revoke reason', async () => {
    const t = await makeTenant()
    for (const reason of ['move_out', 'auction', 'lease_ended', 'manual'] as const) {
      await revokeGateAccess(t._id, reason)
    }
    const logs = await AccessLog.find({ tenantId: t._id })
    expect(logs).toHaveLength(4)
    const reasons = logs.map((l) => l.notes).join(' ')
    for (const r of ['move_out', 'auction', 'lease_ended', 'manual']) {
      expect(reasons).toContain(r)
    }
  })
})
