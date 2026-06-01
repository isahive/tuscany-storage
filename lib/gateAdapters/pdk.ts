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
