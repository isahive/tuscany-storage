import mongoose, { Schema } from 'mongoose'
import { connectDB } from '@/lib/db'

/**
 * Advisory lock so a cron job can't run concurrently with itself — two
 * overlapping invocations of the delinquency sweep or the billing run could
 * double-apply fees / double-charge rent. Each job holds a single document
 * keyed by its name; a stale lock (holder crashed) is reclaimed once its
 * `expiresAt` passes.
 */
interface ICronLock {
  _id: string
  acquiredAt: Date
  expiresAt: Date
}

const CronLockSchema = new Schema<ICronLock>({
  _id: { type: String }, // job name
  acquiredAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
})

const CronLock =
  (mongoose.models.CronLock as mongoose.Model<ICronLock>) ||
  mongoose.model<ICronLock>('CronLock', CronLockSchema)

/** Sentinel returned when the lock is already held by another run. */
export const LOCK_SKIPPED = { skipped: 'locked' as const }
export type LockSkipped = typeof LOCK_SKIPPED

/** Type guard so callers can narrow `withCronLock`'s result cleanly. */
export function isLockSkipped(x: unknown): x is LockSkipped {
  return typeof x === 'object' && x !== null && (x as LockSkipped).skipped === 'locked'
}

const DEFAULT_TTL_MS = 10 * 60 * 1000 // 10 min — covers the 300s job maxDuration

/**
 * Run `fn` while holding the named lock. Returns `fn`'s result, or
 * `LOCK_SKIPPED` if another run currently holds the lock. The lock is always
 * released when `fn` settles (success or throw); if the process dies first, the
 * TTL lets the next run reclaim it.
 */
export async function withCronLock<T>(
  name: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T | LockSkipped> {
  // Skip connectDB when a connection is already open (e.g. test harness wired
  // mongoose to an in-memory server) to avoid a duplicate mongoose.connect().
  if (mongoose.connection.readyState !== 1) await connectDB()

  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlMs)

  // Acquire only if there's no lock or the existing one has expired. When a
  // live lock is held, the filter matches nothing and the upsert tries to
  // insert a duplicate _id → E11000, which we read as "already locked".
  try {
    await CronLock.findOneAndUpdate(
      { _id: name, expiresAt: { $lte: now } },
      { $set: { acquiredAt: now, expiresAt } },
      { upsert: true, setDefaultsOnInsert: true },
    )
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) return LOCK_SKIPPED
    throw err
  }

  try {
    return await fn()
  } finally {
    await CronLock.deleteOne({ _id: name })
  }
}

export { CronLock }
