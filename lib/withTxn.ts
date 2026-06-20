import mongoose, { type ClientSession } from 'mongoose'
import { connectDB } from '@/lib/db'

/**
 * MongoDB driver code for "this server can't do transactions". Atlas (and any
 * replica set) supports them; a standalone mongod — which is what local dev and
 * the in-memory test server use — does not. We detect that case and degrade
 * gracefully so the same code path works everywhere.
 */
function isTransactionsUnsupported(err: unknown): boolean {
  const e = err as { code?: number; codeName?: string; message?: string }
  if (e?.code === 20 || e?.codeName === 'IllegalOperation') return true
  const msg = e?.message ?? ''
  return (
    msg.includes('Transaction numbers are only allowed') ||
    msg.includes('replica set') ||
    msg.includes('mongos')
  )
}

/**
 * Run `fn` inside a MongoDB transaction so a multi-document unit of work commits
 * all-or-nothing. The session is passed to `fn` and MUST be threaded into every
 * query/write inside it (`.session(session)` or `{ session }`) — operations
 * without it run outside the transaction.
 *
 * `withTransaction` automatically retries the whole callback on transient write
 * conflicts, so `fn` must be idempotent on re-entry: do read-modify-write
 * entirely inside the callback (re-read documents each attempt) and keep slow,
 * non-DB side-effects (Stripe calls, emails) OUTSIDE.
 *
 * On a standalone server (dev / in-memory tests) transactions aren't available;
 * we run `fn` once without a session. Because a standalone rejects the first
 * write issued under a transaction session before anything persists, the
 * fallback never double-applies writes.
 */
export async function withTxn<T>(
  fn: (session: ClientSession | undefined) => Promise<T>,
): Promise<T> {
  // Skip connectDB when a connection is already open (e.g. test harness wired
  // mongoose to an in-memory server) to avoid a duplicate mongoose.connect().
  if (mongoose.connection.readyState !== 1) await connectDB()
  const session = await mongoose.startSession()
  try {
    let result!: T
    await session.withTransaction(async () => {
      result = await fn(session)
    })
    return result
  } catch (err) {
    if (isTransactionsUnsupported(err)) {
      return fn(undefined)
    }
    throw err
  } finally {
    await session.endSession()
  }
}
