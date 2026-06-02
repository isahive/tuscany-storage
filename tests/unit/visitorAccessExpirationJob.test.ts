import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'

const adapterMocks = vi.hoisted(() => ({
  createHolder: vi.fn(),
  setHolderEnabled: vi.fn(),
  deleteHolder: vi.fn(),
  addHolderToGroup: vi.fn(),
}))
vi.mock('@/lib/gateAdapters/pdk', () => adapterMocks)
vi.mock('@/lib/pdkVisitorGroup', () => ({ ensureVisitorGroup: vi.fn() }))
// connectDB is called inside the job to prevent the production "buffering
// timed out" race; in tests the in-memory mongoose is already connected via
// startTestDb, so we stub connectDB to a no-op to avoid mongoose complaining
// about a competing openUri() against a different URI.
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))

import { runVisitorAccessExpiration } from '@/jobs/visitor-access-expiration'
import VisitorAccess from '@/models/VisitorAccess'

const ORIG_ENV = { ...process.env }

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })

beforeEach(async () => {
  await clearTestDb()
  for (const m of Object.values(adapterMocks)) m.mockReset()
  process.env = { ...ORIG_ENV }
})

function enablePdk() {
  process.env.PDK_SYNC_ENABLED = 'true'
  process.env.PDK_CLIENT_ID = 'x'
  process.env.PDK_CLIENT_SECRET = 'x'
  process.env.PDK_SYSTEM_ID = 'x'
}

describe('runVisitorAccessExpiration', () => {
  it('returns merged summary of expire + activate', async () => {
    enablePdk()
    adapterMocks.deleteHolder.mockResolvedValue(undefined)
    adapterMocks.setHolderEnabled.mockResolvedValue(undefined)

    // One expired pass.
    await VisitorAccess.create({
      name: 'Old', purpose: 'p',
      validFrom: new Date(Date.now() - 2 * 60 * 60_000),
      validUntil: new Date(Date.now() - 60 * 60_000),
      pin: '999991',
      status: 'active',
      pdkHolderId: 'h-old',
      createdBy: 'admin',
    })
    // One in-window pass with holder — gets re-enabled.
    await VisitorAccess.create({
      name: 'Live', purpose: 'p',
      validFrom: new Date(Date.now() - 60_000),
      validUntil: new Date(Date.now() + 60 * 60_000),
      pin: '999992',
      status: 'active',
      pdkHolderId: 'h-live',
      createdBy: 'admin',
    })

    const summary = await runVisitorAccessExpiration()
    expect(summary.expired.expired).toBe(1)
    expect(summary.expired.pdkDeleted).toBe(1)
    expect(summary.activated.activated).toBe(1)
    expect(adapterMocks.deleteHolder).toHaveBeenCalledWith('h-old')
    expect(adapterMocks.setHolderEnabled).toHaveBeenCalledWith('h-live', true)
  })

  it('runs the DB expiration even when PDK is disabled (defense in depth)', async () => {
    delete process.env.PDK_SYNC_ENABLED
    await VisitorAccess.create({
      name: 'Old', purpose: 'p',
      validFrom: new Date(Date.now() - 2 * 60 * 60_000),
      validUntil: new Date(Date.now() - 60 * 60_000),
      pin: '999993',
      status: 'active',
      createdBy: 'admin',
    })
    const summary = await runVisitorAccessExpiration()
    expect(summary.expired.expired).toBe(1)
    expect(summary.activated.scanned).toBe(0)
    expect(adapterMocks.deleteHolder).not.toHaveBeenCalled()
  })

  it('returns zeros when nothing is due', async () => {
    enablePdk()
    const summary = await runVisitorAccessExpiration()
    expect(summary.expired.scanned).toBe(0)
    expect(summary.activated.scanned).toBe(0)
  })
})
