/**
 * One-shot migration: provision a PDK Holder for every existing active tenant
 * that does not yet have `pdkHolderId` set.
 *
 * After this runs, the reconcile cron and the per-write sync hooks keep PDK
 * in step with Tuscany. This script only fills the gap for tenants that pre-
 * date the integration.
 *
 * Safe to re-run — `syncTenantToPdk` is idempotent.
 *
 * Usage:  npx tsx --env-file=.env.local scripts/backfill-pdk-holders.ts
 */
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import { syncTenantToPdk } from '@/lib/pdkSync'

async function main() {
  for (const v of ['PDK_CLIENT_ID', 'PDK_CLIENT_SECRET', 'PDK_SYSTEM_ID']) {
    if (!process.env[v]) {
      console.error(`${v} is required — aborting.`)
      process.exit(1)
    }
  }

  console.log('Connecting to MongoDB…')
  await connectDB()
  console.log('Connected.')

  // Only sync tenants that should currently have a holder. Archived and
  // waiting-list rows don't need one.
  const candidates = await Tenant.find({
    pdkHolderId: { $exists: false },
    archived: { $ne: true },
    onWaitingList: { $ne: true },
    isRetailWalkIn: { $ne: true },
  }).select('_id firstName lastName status')

  console.log(`Tenants needing provisioning: ${candidates.length}\n`)

  let created = 0
  let failed = 0

  for (const t of candidates) {
    try {
      const res = await syncTenantToPdk(t._id as any)
      created++
      console.log(`  ✓ ${t.firstName} ${t.lastName} → ${res.pdkHolderId}`)
    } catch (err) {
      failed++
      console.error(`  ✗ ${t.firstName} ${t.lastName}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nDone.  created=${created}  failed=${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
