import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeTenant } from '@/tests/helpers/factories'
import Tenant from '@/models/Tenant'

const adapterMocks = vi.hoisted(() => ({
  createHolder: vi.fn(),
  updateHolderPin: vi.fn(),
  setHolderEnabled: vi.fn(),
  deleteHolder: vi.fn(),
}))

vi.mock('@/lib/gateAdapters/pdk', () => adapterMocks)

import { syncTenantToPdk, unlinkTenantFromPdk, syncTenantToPdkSafe, pdkConfigured } from './pdkSync'

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })

beforeEach(async () => {
  await clearTestDb()
  adapterMocks.createHolder.mockReset()
  adapterMocks.updateHolderPin.mockReset()
  adapterMocks.setHolderEnabled.mockReset()
  adapterMocks.deleteHolder.mockReset()
})

describe('syncTenantToPdk (first time)', () => {
  it('POSTs createHolder, saves pdkHolderId, marks pdkSyncedAt', async () => {
    const t = await makeTenant({ gateCode: '1234', status: 'active' })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'pdk-h-1' })

    const res = await syncTenantToPdk(t._id as any)
    expect(res).toEqual({ action: 'created', pdkHolderId: 'pdk-h-1' })

    expect(adapterMocks.createHolder).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        pin: '1234',
        enabled: true,
      }),
    )
    expect(adapterMocks.updateHolderPin).not.toHaveBeenCalled()

    const reloaded = await Tenant.findById(t._id)
    expect(reloaded!.pdkHolderId).toBe('pdk-h-1')
    expect(reloaded!.pdkSyncedAt).toBeInstanceOf(Date)
  })

  it('omits pin from createHolder when tenant has no gateCode', async () => {
    const t = await makeTenant({ status: 'active' })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'pdk-h-2' })

    await syncTenantToPdk(t._id as any)

    const arg = adapterMocks.createHolder.mock.calls[0][0]
    expect('pin' in arg).toBe(false)
  })

  it('creates a holder with enabled=false when tenant is locked out', async () => {
    const t = await makeTenant({ status: 'locked_out', lockedOutAt: new Date() })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'pdk-h-3' })

    await syncTenantToPdk(t._id as any)
    expect(adapterMocks.createHolder.mock.calls[0][0].enabled).toBe(false)
  })

  it('creates with enabled=false when tenant is moved_out', async () => {
    const t = await makeTenant({ status: 'moved_out' })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'pdk-h-4' })

    await syncTenantToPdk(t._id as any)
    expect(adapterMocks.createHolder.mock.calls[0][0].enabled).toBe(false)
  })

  it('keeps enabled=true for delinquent (still has access until lockout)', async () => {
    const t = await makeTenant({ status: 'delinquent' })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'pdk-h-5' })

    await syncTenantToPdk(t._id as any)
    expect(adapterMocks.createHolder.mock.calls[0][0].enabled).toBe(true)
  })
})

describe('syncTenantToPdk (existing holder)', () => {
  it('PATCHes pin and enabled, updates pdkSyncedAt', async () => {
    const t = await makeTenant({
      gateCode: '9999',
      status: 'active',
      pdkHolderId: 'pdk-existing',
    })
    adapterMocks.updateHolderPin.mockResolvedValueOnce(undefined)
    adapterMocks.setHolderEnabled.mockResolvedValueOnce(undefined)

    const res = await syncTenantToPdk(t._id as any)
    expect(res).toEqual({ action: 'updated', pdkHolderId: 'pdk-existing' })

    expect(adapterMocks.createHolder).not.toHaveBeenCalled()
    expect(adapterMocks.updateHolderPin).toHaveBeenCalledWith('pdk-existing', '9999')
    expect(adapterMocks.setHolderEnabled).toHaveBeenCalledWith('pdk-existing', true)
  })

  it('sends pin=null when gateCode is unset (clearing PIN access)', async () => {
    const t = await makeTenant({
      status: 'active',
      pdkHolderId: 'pdk-existing-2',
    })
    adapterMocks.updateHolderPin.mockResolvedValueOnce(undefined)
    adapterMocks.setHolderEnabled.mockResolvedValueOnce(undefined)

    await syncTenantToPdk(t._id as any)
    expect(adapterMocks.updateHolderPin).toHaveBeenCalledWith('pdk-existing-2', null)
  })

  it('sets enabled=false when tenant is locked out', async () => {
    const t = await makeTenant({
      gateCode: '1111',
      status: 'locked_out',
      lockedOutAt: new Date(),
      pdkHolderId: 'pdk-existing-3',
    })
    adapterMocks.updateHolderPin.mockResolvedValueOnce(undefined)
    adapterMocks.setHolderEnabled.mockResolvedValueOnce(undefined)

    await syncTenantToPdk(t._id as any)
    expect(adapterMocks.setHolderEnabled).toHaveBeenCalledWith('pdk-existing-3', false)
  })
})

describe('syncTenantToPdk error cases', () => {
  it('throws when tenant does not exist', async () => {
    const fakeId = new (await import('mongoose')).Types.ObjectId().toString()
    await expect(syncTenantToPdk(fakeId)).rejects.toThrow(/not found/)
  })
})

describe('pdkConfigured', () => {
  const ORIGINAL = { ...process.env }

  beforeEach(() => {
    process.env.PDK_CLIENT_ID = 'c'
    process.env.PDK_CLIENT_SECRET = 's'
    process.env.PDK_SYSTEM_ID = 'sys'
  })

  it('returns true when all three env vars are set', () => {
    expect(pdkConfigured()).toBe(true)
  })

  it('returns false when any var is missing', () => {
    delete process.env.PDK_CLIENT_SECRET
    expect(pdkConfigured()).toBe(false)
    process.env.PDK_CLIENT_SECRET = ORIGINAL.PDK_CLIENT_SECRET
  })
})

describe('syncTenantToPdkSafe', () => {
  beforeEach(() => {
    process.env.PDK_CLIENT_ID = 'c'
    process.env.PDK_CLIENT_SECRET = 's'
    process.env.PDK_SYSTEM_ID = 'sys'
  })

  it('skips silently and does not call the adapter when PDK is not configured', async () => {
    delete process.env.PDK_CLIENT_ID
    const t = await makeTenant({ status: 'active', gateCode: '1' })
    await syncTenantToPdkSafe(t._id as any)
    expect(adapterMocks.createHolder).not.toHaveBeenCalled()
  })

  it('does the sync when configured', async () => {
    const t = await makeTenant({ status: 'active', gateCode: '7' })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'new' })
    await syncTenantToPdkSafe(t._id as any)
    expect(adapterMocks.createHolder).toHaveBeenCalled()
  })

  it('swallows adapter errors and logs a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const t = await makeTenant({ status: 'active', gateCode: '7' })
    adapterMocks.createHolder.mockRejectedValueOnce(new Error('PDK 503'))

    await expect(syncTenantToPdkSafe(t._id as any)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/PDK 503/))
    warn.mockRestore()
  })
})

describe('unlinkTenantFromPdk', () => {
  it('DELETEs the holder and clears pdkHolderId locally', async () => {
    const t = await makeTenant({ pdkHolderId: 'pdk-bye' })
    adapterMocks.deleteHolder.mockResolvedValueOnce(undefined)

    await unlinkTenantFromPdk(t._id as any)
    expect(adapterMocks.deleteHolder).toHaveBeenCalledWith('pdk-bye')

    const after = await Tenant.findById(t._id)
    expect(after!.pdkHolderId).toBeUndefined()
    expect(after!.pdkSyncedAt).toBeInstanceOf(Date)
  })

  it('is a no-op when tenant has no pdkHolderId', async () => {
    const t = await makeTenant()
    await unlinkTenantFromPdk(t._id as any)
    expect(adapterMocks.deleteHolder).not.toHaveBeenCalled()
  })
})
