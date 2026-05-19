import type { ITenantDocument } from '@/models/Tenant'
import type { ISettingsDocument } from '@/models/Settings'

/**
 * Thin client for the external gate controller that Tuscany has wired in
 * front of the storage facility. Storable Easy talks to the same kind of box
 * (PTI Cloud, OpenTech IoT, DoorKing IM, …) via a vendor-specific REST API.
 *
 * We keep the call shape minimal — the integrator at install time configures
 * `gateApiEndpoint` and `gateApiKey` in Settings, and writes a tiny adapter on
 * their side that maps our `{ action, gateCode, tenantId }` payload onto the
 * vendor's actual revoke/grant endpoints. That way swapping vendors only
 * touches their adapter, not our cron.
 *
 * Both functions are best-effort: if the gate API is unreachable we log and
 * return false so the cron can keep going. The local DB still reflects the
 * intended state (gateCode cleared on revoke).
 */

export type GateAction = 'revoke' | 'grant'

interface GateRequestBody {
  action: GateAction
  tenantId: string
  gateCode: string | null
  reason?: string
}

interface GateSettingsSubset {
  gateApiEndpoint?: string
  gateApiKey?: string
  gateNodeId?: string
}

async function callGate(
  settings: GateSettingsSubset,
  body: GateRequestBody,
): Promise<boolean> {
  if (!settings.gateApiEndpoint || !settings.gateApiKey) {
    // No external gate wired — local revoke (gateCode clear) is the only
    // enforcement. This is the dev / unintegrated default.
    return false
  }

  try {
    const res = await fetch(settings.gateApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.gateApiKey}`,
        ...(settings.gateNodeId ? { 'X-Gate-Node': settings.gateNodeId } : {}),
      },
      body: JSON.stringify(body),
      // 10s ceiling — gate controllers on flaky cellular links can sit on a
      // request forever. Better to fail fast and let the next cron retry.
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[GateController] ${body.action} HTTP ${res.status}: ${text}`)
      return false
    }
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[GateController] ${body.action} failed:`, msg)
    return false
  }
}

export async function revokeAccess(
  tenant: Pick<ITenantDocument, '_id' | 'gateCode'>,
  settings: Pick<ISettingsDocument, 'gateApiEndpoint' | 'gateApiKey' | 'gateNodeId'>,
  reason?: string,
): Promise<boolean> {
  return callGate(settings, {
    action: 'revoke',
    tenantId: String(tenant._id),
    gateCode: tenant.gateCode ?? null,
    reason,
  })
}

export async function grantAccess(
  tenant: Pick<ITenantDocument, '_id' | 'gateCode'>,
  settings: Pick<ISettingsDocument, 'gateApiEndpoint' | 'gateApiKey' | 'gateNodeId'>,
  reason?: string,
): Promise<boolean> {
  return callGate(settings, {
    action: 'grant',
    tenantId: String(tenant._id),
    gateCode: tenant.gateCode ?? null,
    reason,
  })
}
