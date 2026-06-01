import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'

const adapterMocks = vi.hoisted(() => ({
  createHolder: vi.fn(),
  getHolder: vi.fn(),
  listHolders: vi.fn(),
  updateHolderPin: vi.fn(),
  setHolderEnabled: vi.fn(),
  deleteHolder: vi.fn(),
  addHolderToGroup: vi.fn(),
}))

vi.mock('@/lib/gateAdapters/pdk', () => adapterMocks)
// Don't trigger the facility-hours sync (which would itself hit groups/rules
// adapter mocks). It's exercised in its own test file.
vi.mock('@/lib/pdkFacilityHours', () => ({
  syncFacilityHoursToPdkSafe: vi.fn(async () => undefined),
}))

import { reconcilePdkHolders } from '@/jobs/pdk-reconcile'
import Tenant from '@/models/Tenant'

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })

beforeEach(async () => {
  await clearTestDb()
  for (const m of Object.values(adapterMocks)) m.mockReset()
})

describe('reconcilePdkHolders', () => {
  it('provisions tenants without pdkHolderId', async () => {
    await makeTenant({ status: 'active', gateCode: '1111' })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'new-holder' })

    const s = await reconcilePdkHolders()
    expect(s.scanned).toBe(1)
    expect(s.provisioned).toBe(1)
    expect(s.patched).toBe(0)
    expect(s.inSync).toBe(0)
    expect(adapterMocks.createHolder).toHaveBeenCalled()
  })

  it('marks in-sync when PDK matches local state', async () => {
    await makeTenant({
      status: 'active',
      gateCode: '4321',
      pdkHolderId: 'h-aligned',
    })
    adapterMocks.getHolder.mockResolvedValueOnce({
      id: 'h-aligned', firstName: 'X', lastName: 'Y',
      pin: '4321', enabled: true,
    })

    const s = await reconcilePdkHolders()
    expect(s.inSync).toBe(1)
    expect(s.patched).toBe(0)
    expect(adapterMocks.updateHolderPin).not.toHaveBeenCalled()
    expect(adapterMocks.setHolderEnabled).not.toHaveBeenCalled()
  })

  it('patches when PIN has drifted', async () => {
    await makeTenant({
      status: 'active',
      gateCode: '7777',
      pdkHolderId: 'h-drift',
    })
    adapterMocks.getHolder.mockResolvedValueOnce({
      id: 'h-drift', firstName: 'X', lastName: 'Y',
      pin: 'OLD', enabled: true,
    })
    adapterMocks.updateHolderPin.mockResolvedValueOnce(undefined)
    adapterMocks.setHolderEnabled.mockResolvedValueOnce(undefined)

    const s = await reconcilePdkHolders()
    expect(s.patched).toBe(1)
    expect(adapterMocks.updateHolderPin).toHaveBeenCalledWith('h-drift', '7777')
  })

  it('patches when enabled state has drifted (tenant locked, remote enabled)', async () => {
    await makeTenant({
      status: 'locked_out',
      lockedOutAt: new Date(),
      gateCode: '2222',
      pdkHolderId: 'h-stuck-enabled',
    })
    adapterMocks.getHolder.mockResolvedValueOnce({
      id: 'h-stuck-enabled', firstName: 'X', lastName: 'Y',
      pin: '2222', enabled: true,
    })
    adapterMocks.updateHolderPin.mockResolvedValueOnce(undefined)
    adapterMocks.setHolderEnabled.mockResolvedValueOnce(undefined)

    const s = await reconcilePdkHolders()
    expect(s.patched).toBe(1)
    expect(adapterMocks.setHolderEnabled).toHaveBeenCalledWith('h-stuck-enabled', false)
  })

  it('treats null-pin local + null-pin remote as in-sync', async () => {
    await makeTenant({
      status: 'active',
      pdkHolderId: 'h-no-pin',
    })
    adapterMocks.getHolder.mockResolvedValueOnce({
      id: 'h-no-pin', firstName: 'X', lastName: 'Y', enabled: true,
    })

    const s = await reconcilePdkHolders()
    expect(s.inSync).toBe(1)
    expect(s.patched).toBe(0)
  })

  it('skips archived, waiting-list, and retail-walk-in tenants', async () => {
    await makeTenant({ status: 'active', archived: true, gateCode: '1' })
    await makeTenant({ status: 'active', onWaitingList: true, gateCode: '2' })
    await makeTenant({ status: 'active', isRetailWalkIn: true, gateCode: '3' })

    const s = await reconcilePdkHolders()
    expect(s.scanned).toBe(0)
    expect(adapterMocks.getHolder).not.toHaveBeenCalled()
    expect(adapterMocks.createHolder).not.toHaveBeenCalled()
  })

  it('continues past failures and tallies errors', async () => {
    const t1 = await makeTenant({ status: 'active', pdkHolderId: 'h-bad' })
    const t2 = await makeTenant({ status: 'active', pdkHolderId: 'h-ok', gateCode: '1234' })

    adapterMocks.getHolder
      .mockRejectedValueOnce(new Error('PDK 503'))
      .mockResolvedValueOnce({ id: 'h-ok', firstName: 'X', lastName: 'Y', pin: '1234', enabled: true })

    const s = await reconcilePdkHolders()
    expect(s.failed).toBe(1)
    expect(s.inSync).toBe(1)
    expect(s.errors).toHaveLength(1)
    expect(s.errors[0].tenantId).toBe(String(t1._id))
    expect(s.errors[0].message).toMatch(/503/)
  })

  it('processes a mixed batch correctly', async () => {
    await makeTenant({ status: 'active', gateCode: 'A' })                            // needs provision
    await makeTenant({ status: 'active', gateCode: 'B', pdkHolderId: 'h-aligned' })  // in sync
    await makeTenant({ status: 'active', gateCode: 'C', pdkHolderId: 'h-drift' })    // needs patch

    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'h-new' })
    adapterMocks.getHolder
      .mockResolvedValueOnce({ id: 'h-aligned', firstName: 'X', lastName: 'Y', pin: 'B', enabled: true })
      .mockResolvedValueOnce({ id: 'h-drift', firstName: 'X', lastName: 'Y', pin: 'OLD', enabled: true })
    adapterMocks.updateHolderPin.mockResolvedValue(undefined)
    adapterMocks.setHolderEnabled.mockResolvedValue(undefined)

    const s = await reconcilePdkHolders()
    expect(s.scanned).toBe(3)
    expect(s.provisioned).toBe(1)
    expect(s.inSync).toBe(1)
    expect(s.patched).toBe(1)
    expect(s.failed).toBe(0)
  })

  it('saves pdkHolderId on tenant after provisioning', async () => {
    const t = await makeTenant({ status: 'active', gateCode: '1' })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'newly-created' })

    await reconcilePdkHolders()
    const after = await Tenant.findById(t._id)
    expect(after!.pdkHolderId).toBe('newly-created')
  })
})
