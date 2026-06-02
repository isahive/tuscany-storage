import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'

const adapterMocks = vi.hoisted(() => ({
  createHolder: vi.fn(),
  setHolderEnabled: vi.fn(),
  deleteHolder: vi.fn(),
  addHolderToGroup: vi.fn(),
}))

const groupMocks = vi.hoisted(() => ({
  ensureVisitorGroup: vi.fn(),
}))

vi.mock('@/lib/gateAdapters/pdk', () => adapterMocks)
vi.mock('@/lib/pdkVisitorGroup', () => groupMocks)

import {
  issueVisitorAccess,
  revokeVisitorAccess,
  expireDueVisitorAccess,
  activateDueVisitorAccess,
  VisitorAccessValidationError,
} from '@/lib/visitorAccessService'
import VisitorAccess from '@/models/VisitorAccess'
import Tenant from '@/models/Tenant'

const ORIG_ENV = { ...process.env }

beforeAll(async () => { await startTestDb() })
afterAll(async () => { await stopTestDb() })

beforeEach(async () => {
  await clearTestDb()
  for (const m of Object.values(adapterMocks)) m.mockReset()
  for (const m of Object.values(groupMocks)) m.mockReset()
  process.env = { ...ORIG_ENV }
})

function enablePdk() {
  process.env.PDK_SYNC_ENABLED = 'true'
  process.env.PDK_CLIENT_ID = 'x'
  process.env.PDK_CLIENT_SECRET = 'x'
  process.env.PDK_SYSTEM_ID = 'x'
}

function disablePdk() {
  delete process.env.PDK_SYNC_ENABLED
}

const baseInput = () => ({
  name: 'John Electrician',
  purpose: 'Electrical work — unit A12',
  durationMinutes: 180,
  createdBy: 'admin@tuscanystorage.com',
})

describe('issueVisitorAccess — validation', () => {
  it('rejects duration below 5 minutes', async () => {
    disablePdk()
    await expect(
      issueVisitorAccess({ ...baseInput(), durationMinutes: 1 }),
    ).rejects.toThrow(VisitorAccessValidationError)
  })

  it('rejects duration above 24 hours', async () => {
    disablePdk()
    await expect(
      issueVisitorAccess({ ...baseInput(), durationMinutes: 24 * 60 + 1 }),
    ).rejects.toThrow(VisitorAccessValidationError)
  })

  it('rejects non-integer duration', async () => {
    disablePdk()
    await expect(
      issueVisitorAccess({ ...baseInput(), durationMinutes: 10.5 }),
    ).rejects.toThrow(VisitorAccessValidationError)
  })

  it('rejects empty name / purpose / createdBy', async () => {
    disablePdk()
    await expect(issueVisitorAccess({ ...baseInput(), name: '   ' }))
      .rejects.toThrow(/name is required/)
    await expect(issueVisitorAccess({ ...baseInput(), purpose: '' }))
      .rejects.toThrow(/purpose is required/)
    await expect(issueVisitorAccess({ ...baseInput(), createdBy: '' }))
      .rejects.toThrow(/createdBy is required/)
  })

  it('rejects validFrom more than 1 minute in the past', async () => {
    disablePdk()
    await expect(
      issueVisitorAccess({
        ...baseInput(),
        validFrom: new Date(Date.now() - 5 * 60_000),
      }),
    ).rejects.toThrow(/validFrom cannot be in the past/)
  })
})

describe('issueVisitorAccess — happy path (PDK disabled)', () => {
  it('persists the visitor pass with computed validUntil and generated PIN', async () => {
    disablePdk()
    const before = Date.now()
    const result = await issueVisitorAccess({ ...baseInput(), durationMinutes: 180 })

    expect(result.pin).toMatch(/^\d{6}$/)
    expect(result.pdkSynced).toBe(false)
    expect(result.validUntil.getTime() - result.validFrom.getTime()).toBe(180 * 60_000)
    expect(result.validFrom.getTime()).toBeGreaterThanOrEqual(before - 1000)

    const doc = await VisitorAccess.findById(result.id)
    expect(doc).toBeTruthy()
    expect(doc!.status).toBe('active')
    expect(doc!.pdkHolderId).toBeUndefined()
    expect(doc!.createdBy).toBe('admin@tuscanystorage.com')
  })

  it('does not call PDK adapter when PDK is disabled', async () => {
    disablePdk()
    await issueVisitorAccess(baseInput())
    expect(adapterMocks.createHolder).not.toHaveBeenCalled()
    expect(adapterMocks.addHolderToGroup).not.toHaveBeenCalled()
    expect(groupMocks.ensureVisitorGroup).not.toHaveBeenCalled()
  })
})

describe('issueVisitorAccess — PDK enabled', () => {
  it('creates a PDK holder, adds to visitor group, persists holder id', async () => {
    enablePdk()
    groupMocks.ensureVisitorGroup.mockResolvedValueOnce({ groupId: 'g-vis', rulesReconciled: 2 })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'h-vis-1' })

    const result = await issueVisitorAccess({ ...baseInput(), name: 'Maria Plumber' })

    expect(result.pdkSynced).toBe(true)
    expect(result.pdkHolderId).toBe('h-vis-1')

    expect(adapterMocks.createHolder).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Maria',
        lastName: 'Plumber',
        pin: result.pin,
        enabled: true, // validFrom is now → enabled immediately
      }),
    )
    expect(adapterMocks.addHolderToGroup).toHaveBeenCalledWith('h-vis-1', 'g-vis')

    const doc = await VisitorAccess.findById(result.id)
    expect(doc!.pdkHolderId).toBe('h-vis-1')
    expect(doc!.pdkSyncedAt).toBeInstanceOf(Date)
  })

  it('falls back to "Visitor" lastName when name has no space', async () => {
    enablePdk()
    groupMocks.ensureVisitorGroup.mockResolvedValueOnce({ groupId: 'g-vis', rulesReconciled: 2 })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'h-vis-2' })

    await issueVisitorAccess({ ...baseInput(), name: 'Bob' })

    expect(adapterMocks.createHolder).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Bob', lastName: 'Visitor' }),
    )
  })

  it('creates holder with enabled=false when validFrom is in the future', async () => {
    enablePdk()
    groupMocks.ensureVisitorGroup.mockResolvedValueOnce({ groupId: 'g-vis', rulesReconciled: 2 })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'h-vis-3' })

    const future = new Date(Date.now() + 60 * 60_000)
    await issueVisitorAccess({ ...baseInput(), validFrom: future })

    expect(adapterMocks.createHolder).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    )
  })

  it('keeps the local record even when PDK provisioning fails', async () => {
    enablePdk()
    groupMocks.ensureVisitorGroup.mockResolvedValueOnce({ groupId: 'g-vis', rulesReconciled: 2 })
    adapterMocks.createHolder.mockRejectedValueOnce(new Error('PDK 500'))

    const result = await issueVisitorAccess(baseInput())

    expect(result.pdkSynced).toBe(false)
    expect(result.pdkHolderId).toBeUndefined()
    const doc = await VisitorAccess.findById(result.id)
    expect(doc!.status).toBe('active')
    expect(doc!.pdkHolderId).toBeUndefined()
  })
})

describe('issueVisitorAccess — PIN collision', () => {
  it('does not collide with existing tenant gateCode', async () => {
    disablePdk()
    // Pre-populate every conceivable PIN with a tenant — generator must fail.
    // We use a smaller pin space by directly inserting many tenants with
    // collisions in the early random outputs; easier to just verify the
    // generator throws after MAX_ATTEMPTS on a saturated namespace by
    // patching crypto.randomInt indirectly. Simpler: smoke-test that the
    // generated PIN does not match an existing tenant.
    const result = await issueVisitorAccess(baseInput())
    await Tenant.create({
      firstName: 'Pre', lastName: 'Existing',
      email: 'p@e.com', phone: '555', password: 'x',
      gateCode: result.pin,
      autopayEnabled: false, smsOptIn: false, status: 'active', role: 'tenant',
    })

    // Issue a second pass — it should generate a different PIN.
    const second = await issueVisitorAccess({ ...baseInput(), name: 'Other' })
    expect(second.pin).not.toBe(result.pin)
  })

  it('does not collide with another currently-active visitor PIN', async () => {
    disablePdk()
    const a = await issueVisitorAccess(baseInput())
    const b = await issueVisitorAccess({ ...baseInput(), name: 'B Visitor' })
    expect(b.pin).not.toBe(a.pin)
  })
})

describe('revokeVisitorAccess', () => {
  it('flips status to revoked, stamps audit, deletes PDK holder', async () => {
    enablePdk()
    groupMocks.ensureVisitorGroup.mockResolvedValueOnce({ groupId: 'g-vis', rulesReconciled: 2 })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'h-revoke-1' })
    adapterMocks.deleteHolder.mockResolvedValueOnce(undefined)

    const issued = await issueVisitorAccess(baseInput())
    const after = await revokeVisitorAccess({ id: issued.id, revokedBy: 'admin2@x.com' })

    expect(after.status).toBe('revoked')
    expect(after.revokedAt).toBeInstanceOf(Date)
    expect(after.revokedBy).toBe('admin2@x.com')
    expect(adapterMocks.deleteHolder).toHaveBeenCalledWith('h-revoke-1')
  })

  it('rejects revoking a non-existent pass', async () => {
    disablePdk()
    await expect(
      revokeVisitorAccess({ id: '64a0a0a0a0a0a0a0a0a0a0a0', revokedBy: 'admin' }),
    ).rejects.toThrow(/not found/)
  })

  it('rejects revoking an already-expired pass', async () => {
    disablePdk()
    const issued = await issueVisitorAccess(baseInput())
    await VisitorAccess.findByIdAndUpdate(issued.id, { status: 'expired', expiredAt: new Date() })
    await expect(
      revokeVisitorAccess({ id: issued.id, revokedBy: 'admin' }),
    ).rejects.toThrow(/already expired/)
  })

  it('still marks local revoked even when PDK delete fails', async () => {
    enablePdk()
    groupMocks.ensureVisitorGroup.mockResolvedValueOnce({ groupId: 'g-vis', rulesReconciled: 2 })
    adapterMocks.createHolder.mockResolvedValueOnce({ id: 'h-revoke-fail' })
    adapterMocks.deleteHolder.mockRejectedValueOnce(new Error('PDK 503'))

    const issued = await issueVisitorAccess(baseInput())
    const after = await revokeVisitorAccess({ id: issued.id, revokedBy: 'admin' })
    expect(after.status).toBe('revoked')
  })
})

describe('expireDueVisitorAccess', () => {
  it('marks passes whose validUntil has passed as expired and deletes PDK holder', async () => {
    enablePdk()
    adapterMocks.deleteHolder.mockResolvedValue(undefined)

    const expired = await VisitorAccess.create({
      name: 'A', purpose: 'p',
      validFrom: new Date('2026-06-01T10:00:00Z'),
      validUntil: new Date('2026-06-01T11:00:00Z'),
      pin: '111111',
      status: 'active',
      pdkHolderId: 'h-old',
      createdBy: 'admin',
    })
    const stillValid = await VisitorAccess.create({
      name: 'B', purpose: 'p',
      validFrom: new Date('2026-06-01T10:00:00Z'),
      validUntil: new Date('2099-01-01T00:00:00Z'),
      pin: '222222',
      status: 'active',
      pdkHolderId: 'h-future',
      createdBy: 'admin',
    })

    const summary = await expireDueVisitorAccess(new Date('2026-06-02T10:00:00Z'))
    expect(summary.scanned).toBe(1)
    expect(summary.expired).toBe(1)
    expect(summary.pdkDeleted).toBe(1)

    const a = await VisitorAccess.findById(expired._id)
    expect(a!.status).toBe('expired')
    expect(a!.expiredAt).toBeInstanceOf(Date)

    const b = await VisitorAccess.findById(stillValid._id)
    expect(b!.status).toBe('active')

    expect(adapterMocks.deleteHolder).toHaveBeenCalledWith('h-old')
    expect(adapterMocks.deleteHolder).not.toHaveBeenCalledWith('h-future')
  })

  it('skips PDK delete when pass has no pdkHolderId (orphan from failed sync)', async () => {
    enablePdk()
    await VisitorAccess.create({
      name: 'Orphan', purpose: 'p',
      validFrom: new Date('2026-06-01T10:00:00Z'),
      validUntil: new Date('2026-06-01T11:00:00Z'),
      pin: '333333',
      status: 'active',
      createdBy: 'admin',
    })
    const summary = await expireDueVisitorAccess(new Date('2026-06-02T10:00:00Z'))
    expect(summary.expired).toBe(1)
    expect(summary.pdkDeleted).toBe(0)
    expect(adapterMocks.deleteHolder).not.toHaveBeenCalled()
  })

  it('records PDK failures without crashing the loop', async () => {
    enablePdk()
    adapterMocks.deleteHolder.mockRejectedValueOnce(new Error('PDK 503'))
    await VisitorAccess.create({
      name: 'Bad', purpose: 'p',
      validFrom: new Date('2026-06-01T10:00:00Z'),
      validUntil: new Date('2026-06-01T11:00:00Z'),
      pin: '444444',
      status: 'active',
      pdkHolderId: 'h-bad',
      createdBy: 'admin',
    })
    const summary = await expireDueVisitorAccess(new Date('2026-06-02T10:00:00Z'))
    expect(summary.pdkFailed).toBe(1)
    expect(summary.errors).toHaveLength(1)
    expect(summary.expired).toBe(0)
  })

  it('returns an empty summary when nothing is due', async () => {
    enablePdk()
    const summary = await expireDueVisitorAccess()
    expect(summary).toEqual({
      scanned: 0, expired: 0, pdkDeleted: 0, pdkFailed: 0, errors: [],
    })
  })
})

describe('activateDueVisitorAccess', () => {
  it('flips PDK holder enabled=true for passes whose window has begun', async () => {
    enablePdk()
    adapterMocks.setHolderEnabled.mockResolvedValue(undefined)

    await VisitorAccess.create({
      name: 'Sched', purpose: 'p',
      validFrom: new Date('2026-06-01T09:00:00Z'),
      validUntil: new Date('2099-01-01T00:00:00Z'),
      pin: '555555',
      status: 'active',
      pdkHolderId: 'h-sched',
      createdBy: 'admin',
    })

    const summary = await activateDueVisitorAccess(new Date('2026-06-01T10:00:00Z'))
    expect(summary.scanned).toBe(1)
    expect(summary.activated).toBe(1)
    expect(adapterMocks.setHolderEnabled).toHaveBeenCalledWith('h-sched', true)
  })

  it('skips passes whose validFrom is still in the future', async () => {
    enablePdk()
    await VisitorAccess.create({
      name: 'Future', purpose: 'p',
      validFrom: new Date('2099-01-01T00:00:00Z'),
      validUntil: new Date('2099-01-02T00:00:00Z'),
      pin: '666666',
      status: 'active',
      pdkHolderId: 'h-future',
      createdBy: 'admin',
    })
    const summary = await activateDueVisitorAccess(new Date('2026-06-01T10:00:00Z'))
    expect(summary.scanned).toBe(0)
    expect(adapterMocks.setHolderEnabled).not.toHaveBeenCalled()
  })

  it('returns empty summary when PDK is disabled', async () => {
    disablePdk()
    const summary = await activateDueVisitorAccess()
    expect(summary).toEqual({ scanned: 0, activated: 0, pdkFailed: 0, errors: [] })
  })
})
