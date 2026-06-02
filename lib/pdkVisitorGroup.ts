/**
 * Bootstrap + maintain the "Tuscany Visitors" group in PDK.
 *
 * Visitors live in a separate Group from tenants for three reasons:
 *
 *   1. Audit separation — PDK reports on group activity; mixing visitors in
 *      with tenants would muddle the tenant gate timeline.
 *   2. Blast-radius isolation — disabling all visitor access (incident,
 *      ops-pause) is a single group toggle without affecting tenants.
 *   3. Independent rule schedule — visitors get 24/7 access within their
 *      personal validity window; tenants are gated by facility hours.
 *      Per-holder enforcement of the window happens at the cron level
 *      (jobs/visitor-access-expiration.ts) because PDK Holders do NOT
 *      support activation/expiration timestamps (probed 2026-06-02).
 *
 * Idempotent — re-running with existing settings updates rules in place
 * rather than creating duplicates.
 */
import Settings from '@/models/Settings'
import {
  createGroup,
  listGroups,
  createGroupRule,
  listGroupRules,
  updateGroupRule,
  type NewAccessRule,
  type PdkWeekday,
} from '@/lib/gateAdapters/pdk'
import { pdkConfigured } from '@/lib/pdkSync'

const VISITOR_GROUP_NAME = 'Tuscany Visitors'

const ALL_WEEKDAYS: PdkWeekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

async function reconcileRule(
  groupId: string,
  devices: string[],
  startTime: string,
  stopTime: string,
): Promise<void> {
  if (devices.length === 0) return
  const existing = await listGroupRules(groupId)
  const match = existing.find(
    (r) =>
      r.devices.length === devices.length
      && r.devices.every((d) => devices.includes(d)),
  )

  const body: NewAccessRule = {
    devices,
    authenticationPolicy: 'pinOnly',
    startTime,
    stopTime,
    recurring: ALL_WEEKDAYS,
  }

  if (match) {
    await updateGroupRule(groupId, match.id, body)
  } else {
    await createGroupRule(groupId, body)
  }
}

export interface VisitorGroupBootstrapResult {
  groupId: string
  rulesReconciled: number
}

/**
 * Ensure the visitor group + its access rules exist. Safe to call on every
 * visitor pass issuance — the underlying PDK calls are idempotent.
 */
export async function ensureVisitorGroup(): Promise<VisitorGroupBootstrapResult> {
  const settings = await Settings.findOne({})
  if (!settings) throw new Error('ensureVisitorGroup: Settings doc not found')

  // Reuse the stored id; otherwise look up by name (in case it was created
  // out-of-band) and finally create.
  let groupId = settings.pdkVisitorGroupId
  if (!groupId) {
    const groups = await listGroups()
    const found = groups.find((g) => g.name === VISITOR_GROUP_NAME)
    if (found) {
      groupId = found.id
    } else {
      const created = await createGroup(VISITOR_GROUP_NAME)
      groupId = created.id
    }
    settings.pdkVisitorGroupId = groupId
    await settings.save()
  }

  // Visitors get 24/7 access at both entry and exit readers within their
  // personal valid window. Window enforcement is at the cron level, not in
  // the rule schedule, because PDK doesn't expose per-holder timestamps.
  const entry = settings.pdkEntryDeviceIds ?? []
  const exit = settings.pdkExitDeviceIds ?? []
  let count = 0
  if (entry.length) {
    await reconcileRule(groupId, entry, '00:00', '23:59')
    count++
  }
  if (exit.length) {
    await reconcileRule(groupId, exit, '00:00', '23:59')
    count++
  }

  return { groupId, rulesReconciled: count }
}

/** Fire-and-forget; safe-skips when PDK isn't configured. */
export async function ensureVisitorGroupSafe(): Promise<string | null> {
  if (!pdkConfigured()) return null
  try {
    const { groupId } = await ensureVisitorGroup()
    return groupId
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[pdkVisitorGroup] ensure failed: ${msg}`)
    return null
  }
}
