/**
 * Nightly reconciliation between Tuscany tenants and PDK holders.
 *
 * Webhooks and inline sync handle the happy path. This job is the safety net
 * for drift introduced by:
 *   - missed webhooks (PDK retry failure, our endpoint down)
 *   - manual edits in the PDK console
 *   - tenants whose state changed locally while PDK was unreachable
 *
 * For every active, non-archived tenant we:
 *   - provision a PDK holder if `pdkHolderId` is missing
 *   - PATCH PIN / enabled when they don't match the local state
 *   - skip when already aligned
 *
 * Idempotent. Safe to run multiple times back-to-back.
 */
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import type { ITenantDocument } from '@/models/Tenant'
import { getHolder } from '@/lib/gateAdapters/pdk'
import { syncTenantToPdk } from '@/lib/pdkSync'

export interface ReconcileSummary {
  scanned: number
  provisioned: number
  patched: number
  inSync: number
  failed: number
  errors: Array<{ tenantId: string; message: string }>
}

const ACCESSIBLE_STATUSES = new Set(['active', 'delinquent'])

function expectedEnabled(t: Pick<ITenantDocument, 'status' | 'lockedOutAt'>): boolean {
  if (t.lockedOutAt) return false
  return ACCESSIBLE_STATUSES.has(t.status)
}

export async function reconcilePdkHolders(): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    scanned: 0, provisioned: 0, patched: 0, inSync: 0, failed: 0, errors: [],
  }

  const tenants = await Tenant.find({
    archived: { $ne: true },
    onWaitingList: { $ne: true },
    isRetailWalkIn: { $ne: true },
  })

  for (const tenant of tenants) {
    summary.scanned++
    try {
      if (!tenant.pdkHolderId) {
        await syncTenantToPdk(tenant._id as any)
        summary.provisioned++
        continue
      }

      const remote = await getHolder(tenant.pdkHolderId)
      const localPin = tenant.gateCode ?? null
      const localEnabled = expectedEnabled(tenant)
      const pinMatches = (remote.pin ?? null) === localPin
      const enabledMatches = remote.enabled === localEnabled

      if (pinMatches && enabledMatches) {
        summary.inSync++
        continue
      }

      // Drift detected — push Tuscany state to PDK.
      await syncTenantToPdk(tenant._id as any)
      summary.patched++
    } catch (err) {
      summary.failed++
      summary.errors.push({
        tenantId: String(tenant._id),
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return summary
}

// Entry-point when invoked directly (cron runner / npx tsx).
async function main() {
  console.log('PDK reconcile: starting…')
  await connectDB()
  const summary = await reconcilePdkHolders()
  console.log(`PDK reconcile: done.
  scanned=${summary.scanned}
  provisioned=${summary.provisioned}
  patched=${summary.patched}
  inSync=${summary.inSync}
  failed=${summary.failed}`)
  if (summary.errors.length > 0) {
    console.error('Errors:')
    for (const e of summary.errors) console.error(`  ${e.tenantId}: ${e.message}`)
  }
  process.exit(summary.failed > 0 ? 1 : 0)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
