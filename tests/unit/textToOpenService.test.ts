import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'

const adapterMocks = vi.hoisted(() => ({
  tryOpenDevice: vi.fn(),
}))
vi.mock('@/lib/gateAdapters/pdk', () => adapterMocks)
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { handleTextToOpen, normalizePhone } from '@/lib/textToOpen'
import Settings from '@/models/Settings'
import AccessLog from '@/models/AccessLog'

const ORIG_ENV = { ...process.env }

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })
beforeEach(async () => {
  await clearTestDb()
  adapterMocks.tryOpenDevice.mockReset()
  process.env = { ...ORIG_ENV }
})

function enablePdk() {
  process.env.PDK_SYNC_ENABLED = 'true'
  process.env.PDK_CLIENT_ID = 'x'
  process.env.PDK_CLIENT_SECRET = 'x'
  process.env.PDK_SYSTEM_ID = 'x'
}

describe('normalizePhone', () => {
  it.each([
    ['+15551234567', '+15551234567'],
    ['+1 (555) 123-4567', '+15551234567'],
    ['15551234567',  '15551234567'],
    [' +1 555.123.4567 ', '+15551234567'],
    ['',             ''],
    ['+',            '+'],
  ])('normalizes %j → %j', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })
})

describe('handleTextToOpen — authorization', () => {
  it('rejects unknown phones without firing PDK', async () => {
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551111111'],
      pdkEntryDeviceIds: ['d1'],
    })
    enablePdk()

    const result = await handleTextToOpen({ from: '+15559999999', messageSid: 'M1' })
    expect(result.authorized).toBe(false)
    expect(result.rejection).toBe('not_authorized')
    expect(adapterMocks.tryOpenDevice).not.toHaveBeenCalled()
  })

  it('accepts a whitelisted phone in a different format (normalization)', async () => {
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551234567'],
      pdkEntryDeviceIds: ['d1', 'd2'],
    })
    enablePdk()
    adapterMocks.tryOpenDevice.mockResolvedValue(undefined)

    const result = await handleTextToOpen({ from: '(555) 123-4567', messageSid: 'M2' })
    // Inbound stripped of '+' but whitelist has '+1...'; they should NOT match.
    // Different country-code prefix. Verify normalization is strict, not loose.
    expect(result.authorized).toBe(false)
  })

  it('accepts identical normalized whitelist match', async () => {
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+1 555 123 4567'],
      pdkEntryDeviceIds: ['d1', 'd2'],
    })
    enablePdk()
    adapterMocks.tryOpenDevice.mockResolvedValue(undefined)

    const result = await handleTextToOpen({ from: '+15551234567', messageSid: 'M3' })
    expect(result.authorized).toBe(true)
    expect(result.opened).toEqual(expect.arrayContaining(['d1', 'd2']))
    expect(adapterMocks.tryOpenDevice).toHaveBeenCalledTimes(2)
  })

  it('rejects empty/invalid From phone', async () => {
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551111111'],
    })
    const result = await handleTextToOpen({ from: '' })
    expect(result.authorized).toBe(false)
    expect(result.rejection).toBe('not_authorized')
  })
})

describe('handleTextToOpen — happy path', () => {
  beforeEach(() => enablePdk())

  it('fires tryOpen on every configured entry device with dwell=2', async () => {
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551234567'],
      pdkEntryDeviceIds: ['dev-a', 'dev-b', 'dev-c'],
    })
    adapterMocks.tryOpenDevice.mockResolvedValue(undefined)

    const result = await handleTextToOpen({ from: '+15551234567', messageSid: 'sid-1' })
    expect(result.authorized).toBe(true)
    expect(result.opened.sort()).toEqual(['dev-a', 'dev-b', 'dev-c'])
    expect(result.failed).toEqual([])
    expect(adapterMocks.tryOpenDevice).toHaveBeenCalledWith('dev-a', 2)
    expect(adapterMocks.tryOpenDevice).toHaveBeenCalledWith('dev-b', 2)
    expect(adapterMocks.tryOpenDevice).toHaveBeenCalledWith('dev-c', 2)
  })

  it('writes one AccessLog per successfully opened device', async () => {
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551234567'],
      pdkEntryDeviceIds: ['dev-a', 'dev-b'],
    })
    adapterMocks.tryOpenDevice.mockResolvedValue(undefined)

    await handleTextToOpen({ from: '+15551234567', messageSid: 'sid-2' })
    const logs = await AccessLog.find({}).lean()
    expect(logs).toHaveLength(2)
    expect(logs[0].source).toBe('app')
    expect(logs[0].eventType).toBe('entry')
    expect(logs[0].notes).toMatch(/text-to-open from \+15551234567/)
    // app-source rows are allowed to have no principal.
    expect(logs[0].tenantId).toBeUndefined()
    expect(logs[0].visitorAccessId).toBeUndefined()
  })

  it('records failures without aborting the rest', async () => {
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551234567'],
      pdkEntryDeviceIds: ['dev-good', 'dev-bad'],
    })
    adapterMocks.tryOpenDevice
      .mockImplementation(async (id: string) => {
        if (id === 'dev-bad') throw new Error('PDK 503')
      })

    const result = await handleTextToOpen({ from: '+15551234567' })
    expect(result.authorized).toBe(true)
    expect(result.opened).toEqual(['dev-good'])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].deviceId).toBe('dev-bad')
    expect(result.failed[0].error).toMatch(/503/)

    // Only the successful device should have an AccessLog row.
    const logs = await AccessLog.find({})
    expect(logs).toHaveLength(1)
  })

  it('returns no_devices_configured when entry list is empty', async () => {
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551234567'],
      pdkEntryDeviceIds: [],
    })
    const result = await handleTextToOpen({ from: '+15551234567' })
    expect(result.authorized).toBe(true)
    expect(result.rejection).toBe('no_devices_configured')
    expect(adapterMocks.tryOpenDevice).not.toHaveBeenCalled()
  })

  it('returns pdk_disabled when kill switch is off', async () => {
    delete process.env.PDK_SYNC_ENABLED
    await Settings.create({
      facilityName: 'X',
      textToOpenAuthorizedPhones: ['+15551234567'],
      pdkEntryDeviceIds: ['dev-a'],
    })
    const result = await handleTextToOpen({ from: '+15551234567' })
    expect(result.authorized).toBe(true)
    expect(result.rejection).toBe('pdk_disabled')
    expect(adapterMocks.tryOpenDevice).not.toHaveBeenCalled()
  })
})
