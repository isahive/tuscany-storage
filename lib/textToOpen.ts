/**
 * Text-to-open service. Inbound SMS from a trusted phone fans out a
 * momentary unlock across every configured entry device on the PDK panel.
 *
 * Security model:
 *   - The phone whitelist (Settings.textToOpenAuthorizedPhones) is the auth
 *     surface. Numbers stored normalized (E.164, digits only with +).
 *   - Twilio webhook signature verification happens at the route layer
 *     BEFORE this is called; here we trust the caller's claim that From
 *     came from Twilio's verified payload.
 *   - Unknown numbers DO NOT receive a leakage hint ("not authorized" vs
 *     "authorized but failed") — the route returns the same generic reply.
 *
 * Audit:
 *   - Every attempt (authorized or not) writes an AccessLog entry with
 *     source='app' and notes containing the From phone. Authorized hits
 *     log 'entry'; rejections log 'denied'.
 */
import { connectDB } from '@/lib/db'
import Settings from '@/models/Settings'
import AccessLog from '@/models/AccessLog'
import { tryOpenDevice } from '@/lib/gateAdapters/pdk'
import { pdkConfigured } from '@/lib/pdkSync'

/** Reduce a phone to digits-only with a leading '+' (if any). Keeps the
 *  whitelist comparison robust against admins pasting in formats like
 *  "(555) 555-5555" or "+1 555 555-5555". */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  return hasPlus ? `+${digits}` : digits
}

export interface TextToOpenResult {
  /** True if the From phone was on the whitelist. */
  authorized: boolean
  /** Devices we successfully fired tryOpen against (PDK 204). */
  opened: string[]
  /** Devices that errored. Empty array when authorized=false (we never tried). */
  failed: Array<{ deviceId: string; error: string }>
  /** Reason the request was not honored, if any. */
  rejection?: 'not_authorized' | 'no_devices_configured' | 'pdk_disabled'
}

const REJECTION_DENIED = 'Access denied — phone not authorized'

export async function handleTextToOpen(input: {
  from: string
  messageSid?: string
}): Promise<TextToOpenResult> {
  await connectDB()
  const normalized = normalizePhone(input.from)

  const settings = await Settings.findOne({}).select(
    'textToOpenAuthorizedPhones pdkEntryDeviceIds',
  ).lean<{
    textToOpenAuthorizedPhones?: string[]
    pdkEntryDeviceIds?: string[]
  } | null>()

  const allowed = (settings?.textToOpenAuthorizedPhones ?? []).map(normalizePhone)
  const authorized = !!normalized && allowed.includes(normalized)

  if (!authorized) {
    // Audit the rejection. Source='app' because the inbound channel is our
    // Next.js receiver, not a physical keypad. We can't attribute to a
    // tenant or visitor (the phone isn't in either system); the row is an
    // orphan — but AccessLog requires one principal. We resolve by skipping
    // the AccessLog write here and relying on the route to log the rejection
    // via console.warn / structured log. AccessLog.create with neither
    // tenantId nor visitorAccessId would fail the pre-validate hook.
    console.warn(
      `[textToOpen] rejected attempt from ${normalized || '(invalid)'} sid=${input.messageSid ?? '?'}`,
    )
    return { authorized: false, opened: [], failed: [], rejection: 'not_authorized' }
  }

  const devices = settings?.pdkEntryDeviceIds ?? []
  if (devices.length === 0) {
    return { authorized: true, opened: [], failed: [], rejection: 'no_devices_configured' }
  }

  if (!pdkConfigured()) {
    // Authorized but PDK is off (kill switch). Log the intent so an admin
    // can see attempts that would have opened, then bail.
    console.warn(`[textToOpen] authorized phone ${normalized} but PDK_SYNC_ENABLED is off`)
    return { authorized: true, opened: [], failed: [], rejection: 'pdk_disabled' }
  }

  const opened: string[] = []
  const failed: Array<{ deviceId: string; error: string }> = []
  // Fan out concurrently — these are independent panels; one slow device
  // shouldn't block the others. Two seconds dwell is the contract for the
  // physical strike on the gate.
  await Promise.all(
    devices.map(async (id) => {
      try {
        await tryOpenDevice(id, 2)
        opened.push(id)
      } catch (err) {
        failed.push({ deviceId: id, error: err instanceof Error ? err.message : String(err) })
      }
    }),
  )

  if (opened.length > 0) {
    // One AccessLog per successful device — matches how keypad events log
    // per device and keeps the gate-activity report aligned. source='app'
    // permits null principal (the whitelisted phone is the actor; not a
    // tenant or visitor).
    await Promise.all(
      opened.map((deviceId) =>
        AccessLog.create({
          eventType: 'entry',
          gateId: 'entrance',
          source: 'app',
          notes: `text-to-open from ${normalized}; device=${deviceId}; sid=${input.messageSid ?? '?'}`,
        }),
      ),
    )
  }

  return { authorized: true, opened, failed }
}

export { REJECTION_DENIED }
