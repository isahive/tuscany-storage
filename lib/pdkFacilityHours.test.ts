import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import Settings from '@/models/Settings'

const adapterMocks = vi.hoisted(() => ({
  createGroup: vi.fn(),
  getGroup: vi.fn(),
  listGroups: vi.fn(),
  deleteGroup: vi.fn(),
  addHolderToGroup: vi.fn(),
  removeHolderFromGroup: vi.fn(),
  createGroupRule: vi.fn(),
  listGroupRules: vi.fn(),
  updateGroupRule: vi.fn(),
  deleteGroupRule: vi.fn(),
}))

vi.mock('@/lib/gateAdapters/pdk', () => adapterMocks)
vi.mock('@/lib/pdkSync', () => ({ pdkConfigured: () => true }))

import {
  syncFacilityHoursToPdk,
  syncFacilityHoursToPdkSafe,
} from './pdkFacilityHours'

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })

beforeEach(async () => {
  await clearTestDb()
  for (const m of Object.values(adapterMocks)) m.mockReset()
  // Default empty list of rules unless a test overrides.
  adapterMocks.listGroupRules.mockResolvedValue([])
})

async function seedSettings(overrides: Record<string, unknown> = {}) {
  // Lean defaults so the test doc validates without touching unrelated
  // fields (agreementTemplate has a complex schema we don't care about here).
  return Settings.create({
    facilityName: 'Tuscany',
    accessHoursStart: '05:00',
    accessHoursEnd: '22:00',
    ...overrides,
  })
}

describe('syncFacilityHoursToPdk — group bootstrap', () => {
  it('creates the Tuscany Tenants group when none exists and saves the id back to Settings', async () => {
    await seedSettings({
      pdkEntryDeviceIds: ['e1'],
      pdkExitDeviceIds: ['x1'],
    })
    adapterMocks.listGroups.mockResolvedValueOnce([])
    adapterMocks.createGroup.mockResolvedValueOnce({ id: 'g-new', name: 'Tuscany Tenants' })

    const res = await syncFacilityHoursToPdk()
    expect(res.groupId).toBe('g-new')

    expect(adapterMocks.createGroup).toHaveBeenCalledWith('Tuscany Tenants')

    const s = await Settings.findOne({})
    expect(s!.pdkTenantGroupId).toBe('g-new')
  })

  it('reuses an existing group with the same name (idempotent across re-runs)', async () => {
    await seedSettings({ pdkEntryDeviceIds: ['e1'] })
    adapterMocks.listGroups.mockResolvedValueOnce([
      { id: 'g-found', name: 'Tuscany Tenants' },
      { id: 'g-other', name: 'Office staff' },
    ])

    const res = await syncFacilityHoursToPdk()
    expect(res.groupId).toBe('g-found')
    expect(adapterMocks.createGroup).not.toHaveBeenCalled()
  })

  it('uses the saved pdkTenantGroupId without listing groups', async () => {
    await seedSettings({
      pdkTenantGroupId: 'g-saved',
      pdkEntryDeviceIds: ['e1'],
    })

    await syncFacilityHoursToPdk()
    expect(adapterMocks.listGroups).not.toHaveBeenCalled()
    expect(adapterMocks.createGroup).not.toHaveBeenCalled()
  })
})

describe('syncFacilityHoursToPdk — entry rule', () => {
  it('creates a pinOnly access rule binding entry devices to accessHoursStart/End', async () => {
    await seedSettings({
      pdkTenantGroupId: 'g1',
      pdkEntryDeviceIds: ['e1', 'e2'],
      pdkExitDeviceIds: [],
      accessHoursStart: '05:00',
      accessHoursEnd: '22:00',
    })

    await syncFacilityHoursToPdk()

    const calls = adapterMocks.createGroupRule.mock.calls
    expect(calls).toHaveLength(1)
    const [groupId, body] = calls[0]
    expect(groupId).toBe('g1')
    expect(body).toMatchObject({
      devices: ['e1', 'e2'],
      authenticationPolicy: 'pinOnly',
      startTime: '05:00',
      stopTime: '22:00',
      recurring: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    })
  })

  it('updates an existing entry rule in place instead of duplicating', async () => {
    await seedSettings({
      pdkTenantGroupId: 'g1',
      pdkEntryDeviceIds: ['e1', 'e2'],
      accessHoursStart: '06:00',
      accessHoursEnd: '21:00',
    })
    adapterMocks.listGroupRules.mockResolvedValueOnce([
      { id: 'r-old', devices: ['e1', 'e2'], startTime: '05:00', stopTime: '22:00' },
    ])

    await syncFacilityHoursToPdk()

    expect(adapterMocks.createGroupRule).not.toHaveBeenCalled()
    expect(adapterMocks.updateGroupRule).toHaveBeenCalledWith(
      'g1',
      'r-old',
      expect.objectContaining({ startTime: '06:00', stopTime: '21:00' }),
    )
  })

  it('skips entry rule creation when no entry devices are configured', async () => {
    await seedSettings({
      pdkTenantGroupId: 'g1',
      pdkEntryDeviceIds: [],
      pdkExitDeviceIds: ['x1'],
    })

    await syncFacilityHoursToPdk()
    // Only one createGroupRule call — for the exit rule.
    const entryCall = adapterMocks.createGroupRule.mock.calls.find(
      (c) => (c[1] as any).devices.includes('x1') === false,
    )
    expect(entryCall).toBeUndefined()
  })
})

describe('syncFacilityHoursToPdk — exit rule', () => {
  it('creates a 24/7 access rule binding exit devices', async () => {
    await seedSettings({
      pdkTenantGroupId: 'g1',
      pdkEntryDeviceIds: [],
      pdkExitDeviceIds: ['x1', 'x2'],
    })

    await syncFacilityHoursToPdk()

    const calls = adapterMocks.createGroupRule.mock.calls
    expect(calls).toHaveLength(1)
    const body = calls[0][1] as any
    expect(body.devices).toEqual(['x1', 'x2'])
    expect(body.startTime).toBe('00:00')
    expect(body.stopTime).toBe('23:59')
    expect(body.recurring).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
  })

  it('does not touch the existing exit rule when devices already match (idempotent)', async () => {
    await seedSettings({
      pdkTenantGroupId: 'g1',
      pdkExitDeviceIds: ['x1'],
    })
    adapterMocks.listGroupRules.mockResolvedValueOnce([
      { id: 'r-exit', devices: ['x1'], startTime: '00:00', stopTime: '23:59' },
    ])

    await syncFacilityHoursToPdk()
    expect(adapterMocks.createGroupRule).not.toHaveBeenCalled()
    expect(adapterMocks.updateGroupRule).toHaveBeenCalledWith(
      'g1',
      'r-exit',
      expect.any(Object),
    )
  })
})

describe('syncFacilityHoursToPdk — happy path with both entry + exit', () => {
  it('reconciles both rules in one call', async () => {
    await seedSettings({
      pdkTenantGroupId: 'g1',
      pdkEntryDeviceIds: ['e1'],
      pdkExitDeviceIds: ['x1'],
      accessHoursStart: '05:00',
      accessHoursEnd: '22:00',
    })

    const res = await syncFacilityHoursToPdk()
    expect(res.entryRules).toBe(1)
    expect(res.exitRules).toBe(1)
    expect(adapterMocks.createGroupRule).toHaveBeenCalledTimes(2)
  })
})

describe('syncFacilityHoursToPdk — error cases', () => {
  it('throws when accessHoursStart is not HH:MM', async () => {
    await seedSettings({
      pdkTenantGroupId: 'g1',
      accessHoursStart: 'invalid',
      accessHoursEnd: '22:00',
    })
    await expect(syncFacilityHoursToPdk()).rejects.toThrow(/HH:MM/)
  })

  it('throws when Settings doc is missing', async () => {
    // No seed — empty DB.
    await expect(syncFacilityHoursToPdk()).rejects.toThrow(/Settings doc not found/)
  })
})

describe('syncFacilityHoursToPdkSafe', () => {
  it('swallows errors and logs a warning', async () => {
    await seedSettings({ pdkTenantGroupId: 'g1', pdkEntryDeviceIds: ['e1'] })
    adapterMocks.createGroupRule.mockRejectedValueOnce(new Error('PDK 503'))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await expect(syncFacilityHoursToPdkSafe()).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/PDK 503/))
    warn.mockRestore()
  })
})
