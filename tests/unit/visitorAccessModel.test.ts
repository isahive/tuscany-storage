import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import VisitorAccess from '@/models/VisitorAccess'

beforeAll(async () => {
  await startTestDb()
  // Mongoose builds indexes in the background; the unique-active-PIN test
  // races the partial index unless we wait for the build to finish.
  await VisitorAccess.init()
})
afterAll(async () => { await stopTestDb() })
beforeEach(async () => { await clearTestDb() })

const validFrom = new Date('2026-06-02T10:00:00Z')
const validUntil = new Date('2026-06-02T13:00:00Z')

function base() {
  return {
    name: 'John Electrician',
    purpose: 'Electrician',
    validFrom,
    validUntil,
    pin: '482915',
    createdBy: 'admin@tuscanystorage.com',
  }
}

describe('VisitorAccess model', () => {
  it('persists a valid visitor pass with default active status', async () => {
    const v = await VisitorAccess.create(base())
    expect(v.status).toBe('active')
    expect(v.pin).toBe('482915')
    expect(v.name).toBe('John Electrician')
    expect(v.validFrom.toISOString()).toBe(validFrom.toISOString())
    expect(v.validUntil.toISOString()).toBe(validUntil.toISOString())
  })

  it('defaults validFrom to createdAt when not provided', async () => {
    const before = Date.now()
    const v = await VisitorAccess.create({
      ...base(),
      validFrom: undefined,
      // validUntil must be in the future relative to the default validFrom (now).
      validUntil: new Date(before + 60 * 60 * 1000),
    })
    expect(v.validFrom.getTime()).toBeGreaterThanOrEqual(before - 1000)
    expect(v.validFrom.getTime()).toBeLessThanOrEqual(Date.now() + 1000)
  })

  it('rejects validUntil <= validFrom', async () => {
    await expect(
      VisitorAccess.create({
        ...base(),
        validUntil: validFrom,
      }),
    ).rejects.toThrow(/validUntil must be strictly after validFrom/)

    await expect(
      VisitorAccess.create({
        ...base(),
        validUntil: new Date(validFrom.getTime() - 1000),
      }),
    ).rejects.toThrow(/validUntil must be strictly after validFrom/)
  })

  it('enforces PIN format (digits only, 4-8 chars)', async () => {
    await expect(VisitorAccess.create({ ...base(), pin: '12ab' })).rejects.toThrow()
    await expect(VisitorAccess.create({ ...base(), pin: '12' })).rejects.toThrow()
    await expect(VisitorAccess.create({ ...base(), pin: '123456789' })).rejects.toThrow()
  })

  it('rejects name exceeding PDK firstName limit (35 chars)', async () => {
    await expect(
      VisitorAccess.create({ ...base(), name: 'x'.repeat(36) }),
    ).rejects.toThrow()
  })

  it('requires purpose, createdBy, name', async () => {
    await expect(VisitorAccess.create({ ...base(), purpose: '' })).rejects.toThrow()
    await expect(VisitorAccess.create({ ...base(), createdBy: '' })).rejects.toThrow()
    await expect(VisitorAccess.create({ ...base(), name: '' })).rejects.toThrow()
  })

  it('enforces unique active PIN (partial index)', async () => {
    await VisitorAccess.create(base())
    // Same PIN, still active → collision.
    await expect(VisitorAccess.create({ ...base(), name: 'Other Visitor' })).rejects.toThrow()
  })

  it('allows reusing a PIN after the prior pass is expired', async () => {
    const first = await VisitorAccess.create(base())
    first.status = 'expired'
    first.expiredAt = new Date()
    await first.save()

    // Same PIN should now be allowed since the prior is no longer active.
    const second = await VisitorAccess.create({ ...base(), name: 'New Visitor' })
    expect(second.status).toBe('active')
  })

  it('allows reusing a PIN after the prior pass is revoked', async () => {
    const first = await VisitorAccess.create(base())
    first.status = 'revoked'
    first.revokedAt = new Date()
    first.revokedBy = 'admin@tuscanystorage.com'
    await first.save()

    const second = await VisitorAccess.create({ ...base(), name: 'New Visitor' })
    expect(second.status).toBe('active')
  })

  it('persists revoked + expired audit timestamps', async () => {
    const v = await VisitorAccess.create(base())
    v.status = 'revoked'
    v.revokedAt = new Date('2026-06-02T11:00:00Z')
    v.revokedBy = 'admin@tuscanystorage.com'
    await v.save()

    const fresh = await VisitorAccess.findById(v._id)
    expect(fresh!.status).toBe('revoked')
    expect(fresh!.revokedAt!.toISOString()).toBe('2026-06-02T11:00:00.000Z')
    expect(fresh!.revokedBy).toBe('admin@tuscanystorage.com')
  })
})
