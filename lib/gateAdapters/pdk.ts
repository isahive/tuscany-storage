/**
 * Domain operations against the PDK API surfaced as plain functions.
 *
 * Why a thin layer over `pdkFetch`: callers (sync helpers, jobs, webhook
 * handler, admin routes) think in terms of "create a holder for this tenant"
 * or "disable this holder", not "PATCH /holders/{id}". This module is the only
 * place that knows the wire shape — if PDK changes a path or field name we
 * fix it in one file.
 *
 * All functions throw on non-2xx. Callers decide whether to swallow or retry;
 * we don't want a silent failure here because that masks gate-access drift,
 * which is the worst failure mode for this integration (tenant locked out
 * with no signal in the logs).
 */
import { pdkFetch } from '@/lib/pdkAuth'

export interface PdkHolder {
  id: string
  firstName: string
  lastName: string
  email?: string
  pin?: string
  enabled: boolean
  groups?: string[]
  partition?: string
}

export interface NewHolderInput {
  firstName: string
  lastName: string
  email?: string
  pin?: string
  /** Defaults to true. Pass false to provision a tenant whose access is
   *  pre-revoked (e.g. lease signed but balance unpaid). */
  enabled?: boolean
  groups?: string[]
}

async function readJsonOrThrow<T>(res: Response, op: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK ${op} failed: ${res.status} ${body}`)
  }
  return (await res.json()) as T
}

export async function createHolder(input: NewHolderInput): Promise<PdkHolder> {
  const res = await pdkFetch('/holders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: input.firstName,
      lastName: input.lastName,
      ...(input.email ? { email: input.email } : {}),
      ...(input.pin ? { pin: input.pin } : {}),
      enabled: input.enabled ?? true,
      ...(input.groups ? { groups: input.groups } : {}),
    }),
  })
  return readJsonOrThrow<PdkHolder>(res, 'createHolder')
}

export async function getHolder(holderId: string): Promise<PdkHolder> {
  const res = await pdkFetch(`/holders/${holderId}`)
  return readJsonOrThrow<PdkHolder>(res, 'getHolder')
}

export async function listHolders(): Promise<PdkHolder[]> {
  const res = await pdkFetch('/holders')
  return readJsonOrThrow<PdkHolder[]>(res, 'listHolders')
}

export async function updateHolderPin(
  holderId: string,
  pin: string | null,
): Promise<void> {
  const res = await pdkFetch(`/holders/${holderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK updateHolderPin failed: ${res.status} ${body}`)
  }
}

export async function setHolderEnabled(
  holderId: string,
  enabled: boolean,
): Promise<void> {
  const res = await pdkFetch(`/holders/${holderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK setHolderEnabled failed: ${res.status} ${body}`)
  }
}

export async function updateHolderName(
  holderId: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  // PDK enforces a 35-char max on firstName (confirmed via probe). Slice
  // defensively so an oversized local name doesn't 400 the whole sync.
  const res = await pdkFetch(`/holders/${holderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: firstName.slice(0, 35),
      lastName: lastName.slice(0, 35),
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK updateHolderName failed: ${res.status} ${body}`)
  }
}

export async function deleteHolder(holderId: string): Promise<void> {
  const res = await pdkFetch(`/holders/${holderId}`, { method: 'DELETE' })
  // PDK returns 204 on successful delete; 404 is treated as already-gone
  // because callers (move-out flow, reconcile) want delete to be idempotent.
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK deleteHolder failed: ${res.status} ${body}`)
  }
}

// ── Groups ────────────────────────────────────────────────────────────────
// PDK's access model: holders join Groups; Groups have access Rules that bind
// device + schedule. So enforcing "tenants can enter 5am-10pm" requires (1) a
// Group for tenants, (2) a Rule on that group with the schedule, (3) every
// tenant holder added to the Group.

export interface PdkGroup {
  id: string
  name: string
  partition?: string
}

export async function createGroup(name: string, partition?: string): Promise<PdkGroup> {
  const res = await pdkFetch('/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...(partition ? { partition } : {}) }),
  })
  return readJsonOrThrow<PdkGroup>(res, 'createGroup')
}

export async function getGroup(groupId: string): Promise<PdkGroup> {
  const res = await pdkFetch(`/groups/${groupId}`)
  return readJsonOrThrow<PdkGroup>(res, 'getGroup')
}

export async function listGroups(): Promise<PdkGroup[]> {
  const res = await pdkFetch('/groups')
  return readJsonOrThrow<PdkGroup[]>(res, 'listGroups')
}

export async function deleteGroup(groupId: string): Promise<void> {
  const res = await pdkFetch(`/groups/${groupId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK deleteGroup failed: ${res.status} ${body}`)
  }
}

export async function addHolderToGroup(holderId: string, groupId: string): Promise<void> {
  const res = await pdkFetch(`/holders/${holderId}/groups/${groupId}`, { method: 'PUT' })
  // 204 No Content on success. 409 / already-member is treated as success
  // because syncTenantToPdk re-runs this idempotently.
  if (!res.ok && res.status !== 409) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK addHolderToGroup failed: ${res.status} ${body}`)
  }
}

export async function removeHolderFromGroup(holderId: string, groupId: string): Promise<void> {
  const res = await pdkFetch(`/holders/${holderId}/groups/${groupId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK removeHolderFromGroup failed: ${res.status} ${body}`)
  }
}

// ── Rules (group-scoped, access type) ─────────────────────────────────────
// PDK's "Rule" object binds a Group (via path) to a set of Devices with a
// schedule. type='access' is the door-unlock rule; other types like 'autoOpen'
// or 'antiPassback' exist but we don't model them.

export type PdkWeekday = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
export type PdkAuthPolicy = 'pinOnly' | 'cardOnly' | 'cardOrPin' | 'cardAndPin'

export interface NewAccessRule {
  /** Devices this rule applies to (entry readers or exit readers). */
  devices: string[]
  /** What credential is required at the reader. */
  authenticationPolicy: PdkAuthPolicy
  /** 24-hour HH:MM. Use '00:00' / '23:59' for all-day. */
  startTime: string
  stopTime: string
  /** Days of the week the rule is active. */
  recurring: PdkWeekday[]
  /** Defaults true (allow). false would explicitly block — unusual for our use. */
  allow?: boolean
}

export interface PdkRule extends NewAccessRule {
  id: string
  type: 'access'
  allow: boolean
}

function ruleBody(rule: NewAccessRule) {
  return {
    type: 'access',
    allow: rule.allow ?? true,
    devices: rule.devices,
    authenticationPolicy: rule.authenticationPolicy,
    startTime: rule.startTime,
    stopTime: rule.stopTime,
    recurring: rule.recurring,
  }
}

export async function createGroupRule(groupId: string, rule: NewAccessRule): Promise<PdkRule> {
  const res = await pdkFetch(`/groups/${groupId}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ruleBody(rule)),
  })
  return readJsonOrThrow<PdkRule>(res, 'createGroupRule')
}

export async function listGroupRules(groupId: string): Promise<PdkRule[]> {
  const res = await pdkFetch(`/groups/${groupId}/rules`)
  return readJsonOrThrow<PdkRule[]>(res, 'listGroupRules')
}

export async function updateGroupRule(
  groupId: string,
  ruleId: string,
  rule: NewAccessRule,
): Promise<void> {
  const res = await pdkFetch(`/groups/${groupId}/rules/${ruleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ruleBody(rule)),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK updateGroupRule failed: ${res.status} ${body}`)
  }
}

export async function deleteGroupRule(groupId: string, ruleId: string): Promise<void> {
  const res = await pdkFetch(`/groups/${groupId}/rules/${ruleId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK deleteGroupRule failed: ${res.status} ${body}`)
  }
}

// ── Connections + cloud-node device control ───────────────────────────────
// The PDK 2.0 docs (developer.pdk.io/web/2.0/rest/devices) expose remote door
// control under /cloud-nodes/{cn}/devices/{d}/{action}. The device's own
// connection record carries the cloud-node id, so callers that only know the
// deviceId need a lookup step. resolveCloudNodeForDevice handles that with a
// minimal in-process cache — the mapping is stable as long as the device
// isn't physically moved between panels.

export interface PdkConnection {
  id: string
  name: string
  cloudNode?: { id: string; name?: string; serialNumber?: string }
}

export interface PdkDevice {
  id: string
  name: string
  connection: string
  type?: string
}

export async function listConnections(): Promise<PdkConnection[]> {
  const res = await pdkFetch('/connections')
  return readJsonOrThrow<PdkConnection[]>(res, 'listConnections')
}

export async function listDevices(): Promise<PdkDevice[]> {
  const res = await pdkFetch('/devices')
  return readJsonOrThrow<PdkDevice[]>(res, 'listDevices')
}

const connectionCloudNodeCache = new Map<string, string>()

/** For tests. */
export function __clearPdkConnectionCache() {
  connectionCloudNodeCache.clear()
}

/**
 * Map a connectionId → cloudNodeId. Cached in-process because the mapping is
 * effectively static (a connection is bound to a single panel for life).
 * On cache miss we fetch the full connections list once and populate every
 * entry; cheaper than per-id GETs.
 */
async function resolveCloudNodeForConnection(connectionId: string): Promise<string> {
  const hit = connectionCloudNodeCache.get(connectionId)
  if (hit) return hit
  const conns = await listConnections()
  for (const c of conns) {
    if (c.cloudNode?.id) connectionCloudNodeCache.set(c.id, c.cloudNode.id)
  }
  const after = connectionCloudNodeCache.get(connectionId)
  if (!after) throw new Error(`PDK connection ${connectionId} has no cloudNode association`)
  return after
}

const deviceConnectionCache = new Map<string, string>()

async function resolveCloudNodeForDevice(deviceId: string): Promise<string> {
  const cachedConnId = deviceConnectionCache.get(deviceId)
  if (cachedConnId) return resolveCloudNodeForConnection(cachedConnId)
  const devices = await listDevices()
  for (const d of devices) deviceConnectionCache.set(d.id, d.connection)
  const connId = deviceConnectionCache.get(deviceId)
  if (!connId) throw new Error(`PDK device ${deviceId} not found`)
  return resolveCloudNodeForConnection(connId)
}

/**
 * Momentary unlock — relay clicks for `dwell` seconds (or the device's
 * configured dwell when omitted), then auto-releases. This is the primary
 * "open the gate remotely" action; use it for text-to-open and admin-panel
 * "open now" buttons.
 */
export async function tryOpenDevice(deviceId: string, dwell?: number): Promise<void> {
  const cn = await resolveCloudNodeForDevice(deviceId)
  const body = dwell !== undefined ? JSON.stringify({ dwell }) : undefined
  const res = await pdkFetch(`/cloud-nodes/${cn}/devices/${deviceId}/try-open`, {
    method: 'POST',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body } : {}),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`PDK tryOpenDevice failed: ${res.status} ${text}`)
  }
}

/** Hold the relay open until a matching closeDevice() call. Use sparingly —
 *  for normal "open the gate once" flows tryOpenDevice() is correct. */
export async function openDevice(deviceId: string): Promise<void> {
  const cn = await resolveCloudNodeForDevice(deviceId)
  const res = await pdkFetch(`/cloud-nodes/${cn}/devices/${deviceId}/open`, { method: 'POST' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`PDK openDevice failed: ${res.status} ${text}`)
  }
}

/** Force-close a held-open device. Safe to call even if already closed. */
export async function closeDevice(deviceId: string): Promise<void> {
  const cn = await resolveCloudNodeForDevice(deviceId)
  const res = await pdkFetch(`/cloud-nodes/${cn}/devices/${deviceId}/close`, { method: 'POST' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`PDK closeDevice failed: ${res.status} ${text}`)
  }
}
