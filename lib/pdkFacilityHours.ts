/**
 * Push the facility's access-hour policy to PDK.
 *
 * The promise we make to tenants is: "you can enter between accessHoursStart
 * and accessHoursEnd, but you can always exit." Enforcing it requires three
 * things on the PDK side:
 *
 *   1. A Group every tenant belongs to (so a single Rule covers everyone).
 *   2. An "access" Rule on that group binding the entry readers to the hours
 *      schedule. After-hours PIN entries get device.request.denied.
 *   3. An "access" Rule on that group binding the exit readers to 24/7. Even
 *      after hours, a tenant who's already inside can swipe out. The hardware
 *      should also have `rex: true` so a Request-to-Exit button works as a
 *      no-credential fallback.
 *
 * Idempotent — re-running with unchanged settings updates the existing Rules
 * in place (PUT) rather than appending duplicates. Settings.pdkTenantGroupId
 * is created on first run and saved back to the doc.
 */
import Settings from '@/models/Settings'
import {
  createGroup,
  listGroups,
  createGroupRule,
  listGroupRules,
  updateGroupRule,
  deleteGroupRule,
  type NewAccessRule,
  type PdkWeekday,
} from '@/lib/gateAdapters/pdk'
import { pdkConfigured } from '@/lib/pdkSync'

const TENANT_GROUP_NAME = 'Tuscany Tenants'

const ALL_WEEKDAYS: PdkWeekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isValidHHMM(s: unknown): s is string {
  return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s)
}

interface RuleSpec {
  devices: string[]
  startTime: string
  stopTime: string
  /** Human label used in logs only. */
  label: 'entry' | 'exit'
}

/**
 * Reconcile a single group rule against the desired spec. If a rule already
 * covers the same devices, we update it in place. If none does, we create one.
 * Other rules for this group/spec.label combination are left untouched —
 * callers can layer multiple entry/exit rule sets if they want different
 * schedules per door cluster.
 */
async function reconcileRule(groupId: string, spec: RuleSpec): Promise<void> {
  if (spec.devices.length === 0) return // nothing to gate
  const existing = await listGroupRules(groupId)
  const matchByDevices = existing.find(
    (r) =>
      r.devices.length === spec.devices.length
      && r.devices.every((d) => spec.devices.includes(d)),
  )

  const body: NewAccessRule = {
    devices: spec.devices,
    authenticationPolicy: 'pinOnly',
    startTime: spec.startTime,
    stopTime: spec.stopTime,
    recurring: ALL_WEEKDAYS,
  }

  if (matchByDevices) {
    await updateGroupRule(groupId, matchByDevices.id, body)
  } else {
    await createGroupRule(groupId, body)
  }
}

export interface FacilityHoursSyncSummary {
  groupId: string
  entryRules: number
  exitRules: number
  skipped: boolean
}

export async function syncFacilityHoursToPdk(): Promise<FacilityHoursSyncSummary> {
  const settings = await Settings.findOne({})
  if (!settings) throw new Error('syncFacilityHoursToPdk: Settings doc not found')

  const start = settings.accessHoursStart
  const stop = settings.accessHoursEnd
  if (!isValidHHMM(start) || !isValidHHMM(stop)) {
    throw new Error(
      `syncFacilityHoursToPdk: accessHoursStart/End must be HH:MM (got "${start}" / "${stop}")`,
    )
  }

  // (1) Ensure the tenant group exists. Reuse existing id if present;
  // otherwise look for one by name (created in a previous run, possibly
  // before pdkTenantGroupId was wired) and finally create a fresh one.
  let groupId = settings.pdkTenantGroupId
  if (!groupId) {
    const groups = await listGroups()
    const found = groups.find((g) => g.name === TENANT_GROUP_NAME)
    if (found) {
      groupId = found.id
    } else {
      const created = await createGroup(TENANT_GROUP_NAME)
      groupId = created.id
    }
    settings.pdkTenantGroupId = groupId
    await settings.save()
  }

  // (2) Entry rule — schedule = accessHoursStart..End.
  await reconcileRule(groupId, {
    devices: settings.pdkEntryDeviceIds ?? [],
    startTime: start,
    stopTime: stop,
    label: 'entry',
  })

  // (3) Exit rule — always-on. Use 00:00..23:59 so the rule is a true 24/7
  // window across every weekday. PDK doesn't have a "no schedule = always"
  // shortcut on access rules; this is the canonical way.
  await reconcileRule(groupId, {
    devices: settings.pdkExitDeviceIds ?? [],
    startTime: '00:00',
    stopTime: '23:59',
    label: 'exit',
  })

  return {
    groupId,
    entryRules: settings.pdkEntryDeviceIds?.length ? 1 : 0,
    exitRules: settings.pdkExitDeviceIds?.length ? 1 : 0,
    skipped: false,
  }
}

/**
 * Fire-and-forget wrapper for use in request handlers. Skips silently when
 * PDK isn't configured (dev / non-PDK deploys), swallows errors so the local
 * Settings write succeeds even if PDK is unreachable.
 */
export async function syncFacilityHoursToPdkSafe(): Promise<void> {
  if (!pdkConfigured()) return
  try {
    await syncFacilityHoursToPdk()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[pdkFacilityHours] sync failed: ${msg}`)
  }
}
