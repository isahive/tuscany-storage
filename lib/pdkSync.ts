/**
 * Push a tenant's current state (PIN, enabled flag, name, email) to PDK.
 *
 * Tuscany is the source of truth for who exists and what their PIN should be;
 * PDK is the source of truth for what physically opens the gate. This module
 * is the one-way write path that keeps them aligned.
 *
 * The function is idempotent — if the tenant already has a `pdkHolderId` we
 * PATCH that holder; otherwise we POST a new one and save the returned id
 * back to the tenant. Callers (admin create/edit, move-out flow, reconcile
 * cron) can invoke it after any change without checking state first.
 *
 * Use `syncTenantToPdkSafe` for fire-and-forget calls from request handlers —
 * it short-circuits when PDK is not configured and swallows network failures
 * so the local write succeeds even if PDK is unreachable. The reconcile cron
 * picks up any resulting drift on its next pass.
 */
import type { Types } from 'mongoose'
import Tenant from '@/models/Tenant'
import type { ITenantDocument } from '@/models/Tenant'
import Settings from '@/models/Settings'
import {
  createHolder,
  updateHolderPin,
  setHolderEnabled,
  deleteHolder,
  addHolderToGroup,
} from '@/lib/gateAdapters/pdk'

type TenantId = Types.ObjectId | string

export function pdkConfigured(): boolean {
  // PDK_SYNC_ENABLED is a kill switch — even when credentials are set the
  // sync stays paused unless this is explicitly 'true'. Protects us from
  // accidentally streaming real tenant data into the shared Developer
  // Sandbox before PDK provisions a real per-customer system.
  if (process.env.PDK_SYNC_ENABLED !== 'true') return false
  return !!(
    process.env.PDK_CLIENT_ID
    && process.env.PDK_CLIENT_SECRET
    && process.env.PDK_SYSTEM_ID
  )
}

/** Status values that mean "tenant can pass the gate right now". */
const ACCESSIBLE_STATUSES = new Set(['active', 'delinquent'])

function tenantIsAccessible(t: Pick<ITenantDocument, 'status' | 'lockedOutAt'>): boolean {
  if (t.lockedOutAt) return false
  return ACCESSIBLE_STATUSES.has(t.status)
}

export interface SyncResult {
  action: 'created' | 'updated' | 'noop'
  pdkHolderId: string
}

export async function syncTenantToPdk(tenantId: TenantId): Promise<SyncResult> {
  const tenant = await Tenant.findById(tenantId)
  if (!tenant) throw new Error(`syncTenantToPdk: tenant ${tenantId} not found`)

  const enabled = tenantIsAccessible(tenant)
  const pin = tenant.gateCode ?? null

  if (!tenant.pdkHolderId) {
    // First-time provisioning — POST a new Holder. We send pin only when the
    // tenant currently has one; empty pin causes a 400 on some PDK builds.
    const created = await createHolder({
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      email: tenant.email,
      ...(pin ? { pin } : {}),
      enabled,
    })
    tenant.pdkHolderId = created.id
    tenant.pdkSyncedAt = new Date()
    await tenant.save()

    // A holder with no Group membership has no effective access (PDK rules
    // are group-scoped). Join the configured tenant group if one exists —
    // that's where the entry/exit hour rules live.
    const settings = await Settings.findOne({}).select('pdkTenantGroupId').lean<{ pdkTenantGroupId?: string } | null>()
    if (settings?.pdkTenantGroupId) {
      await addHolderToGroup(created.id, settings.pdkTenantGroupId)
    }

    return { action: 'created', pdkHolderId: created.id }
  }

  // Existing holder — push pin and enabled state. We do two separate PATCHes
  // because PDK builds vary on whether they accept multi-field PATCH bodies;
  // two single-field calls is the safe lowest-common-denominator.
  await updateHolderPin(tenant.pdkHolderId, pin)
  await setHolderEnabled(tenant.pdkHolderId, enabled)
  tenant.pdkSyncedAt = new Date()
  await tenant.save()
  return { action: 'updated', pdkHolderId: tenant.pdkHolderId }
}

/**
 * Remove the tenant's holder from PDK and clear local linkage. Use on
 * permanent move-out / tenant deletion — not on a temporary lockout where the
 * holder should stay for re-activation later.
 */
export async function unlinkTenantFromPdk(tenantId: TenantId): Promise<void> {
  const tenant = await Tenant.findById(tenantId)
  if (!tenant || !tenant.pdkHolderId) return
  await deleteHolder(tenant.pdkHolderId)
  tenant.pdkHolderId = undefined
  tenant.pdkSyncedAt = new Date()
  await tenant.save()
}

/**
 * Fire-and-forget version for use in request handlers. Skips silently when
 * PDK env vars aren't set (so adding this call to every gate-touching route
 * is safe in dev / non-PDK deployments). Catches and logs all errors so a
 * PDK outage doesn't break the local write — the reconcile cron will heal
 * any drift.
 */
export async function syncTenantToPdkSafe(tenantId: TenantId): Promise<void> {
  if (!pdkConfigured()) return
  try {
    await syncTenantToPdk(tenantId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[pdkSync] tenant ${tenantId}: ${msg}`)
  }
}
