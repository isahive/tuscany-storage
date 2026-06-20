import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { withCronLock, LOCK_SKIPPED, CronLock } from './cronLock'

describe('withCronLock', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('runs the function and releases the lock afterwards', async () => {
    const out = await withCronLock('job-a', async () => 'done')
    expect(out).toBe('done')
    expect(await CronLock.findById('job-a')).toBeNull()
  })

  it('skips when a live lock is already held', async () => {
    await CronLock.create({
      _id: 'job-b',
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    })
    let ran = false
    const out = await withCronLock('job-b', async () => { ran = true; return 'second' })
    expect(out).toBe(LOCK_SKIPPED)
    expect(ran).toBe(false)
    // The held lock must NOT be released by the skipped caller.
    expect(await CronLock.findById('job-b')).not.toBeNull()
  })

  it('reclaims an expired lock', async () => {
    await CronLock.create({
      _id: 'job-c',
      acquiredAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() - 1_000),
    })
    const out = await withCronLock('job-c', async () => 'reclaimed')
    expect(out).toBe('reclaimed')
  })

  it('releases the lock even when the function throws', async () => {
    await expect(
      withCronLock('job-d', async () => { throw new Error('boom') }),
    ).rejects.toThrow('boom')
    expect(await CronLock.findById('job-d')).toBeNull()
  })
})
