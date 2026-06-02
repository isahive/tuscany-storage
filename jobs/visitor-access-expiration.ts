/**
 * Visitor access expiration + activation sweep.
 *
 * Runs every 2 minutes (Render cron `tuscany-visitor-access`). Two passes:
 *
 *   1. Expire — flips `status='expired'` and deletes the PDK holder for any
 *      pass whose `validUntil` has elapsed. This is the SECURITY-CRITICAL
 *      enforcement layer: PDK Holders do NOT support a validUntil field
 *      (probed 2026-06-02), so without this cron a leaked PIN would remain
 *      valid forever. The cron interval IS the worst-case post-expiration
 *      access window for a leaked PIN.
 *
 *   2. Activate — for scheduled passes whose `validFrom` has arrived, PATCH
 *      the PDK holder to enabled=true. Cheap, idempotent.
 *
 * Hard-guarded by `pdkConfigured()` — short-circuits with an empty summary
 * when the kill switch is off, matching the pattern used by pdk-reconcile.
 * The DB-only expiration runs regardless (defense in depth) because flipping
 * the local status doesn't require PDK to be reachable.
 */
import { connectDB } from '@/lib/db'
import {
  expireDueVisitorAccess,
  activateDueVisitorAccess,
  type ExpireVisitorAccessSummary,
  type ActivateVisitorAccessSummary,
} from '@/lib/visitorAccessService'

export interface VisitorAccessExpirationSummary {
  expired: ExpireVisitorAccessSummary
  activated: ActivateVisitorAccessSummary
}

export async function runVisitorAccessExpiration(): Promise<VisitorAccessExpirationSummary> {
  // Unlike pdk-reconcile (which bails on the kill switch before any query),
  // this job always touches the DB — local-state expiration runs even when
  // PDK is off. That means we cannot rely on the API route having warmed
  // the mongoose connection; ensure it ourselves or queries will buffer +
  // time out on cold cron invocations.
  await connectDB()

  const now = new Date()
  // Run expiration first — if PDK is unreachable, local DB still flips state.
  const expired = await expireDueVisitorAccess(now)
  const activated = await activateDueVisitorAccess(now)
  return { expired, activated }
}

async function main() {
  console.log('Visitor access sweep: starting…')
  const summary = await runVisitorAccessExpiration()
  console.log(`Visitor access sweep: done.
  expired.scanned=${summary.expired.scanned}
  expired.expired=${summary.expired.expired}
  expired.pdkDeleted=${summary.expired.pdkDeleted}
  expired.pdkFailed=${summary.expired.pdkFailed}
  activated.scanned=${summary.activated.scanned}
  activated.activated=${summary.activated.activated}
  activated.pdkFailed=${summary.activated.pdkFailed}`)
  const failed = summary.expired.errors.length + summary.activated.errors.length
  if (failed > 0) {
    console.error('Errors:')
    for (const e of [...summary.expired.errors, ...summary.activated.errors]) {
      console.error(`  ${e.id}: ${e.message}`)
    }
  }
  process.exit(failed > 0 ? 1 : 0)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
