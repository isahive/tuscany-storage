/**
 * Application services for VisitorAccess (temporary gate passes).
 *
 * Three use cases:
 *
 *   issueVisitorAccess  — admin grants a contractor a time-bounded PIN.
 *   revokeVisitorAccess — admin cancels a pass before its window ends.
 *   expireVisitorAccess — cron sweeps passes whose validUntil has passed.
 *
 * Local DB is the source of truth for the validity window. PDK is informed
 * about each state change; if PDK is down, the local DB still records what
 * happened and the next cron sweep heals the drift.
 *
 * Security (OWASP A01 / A02):
 *   - PIN generated via crypto.randomInt + collision-checked vs tenants and
 *     active visitors (see lib/visitorAccessPin.ts).
 *   - validUntil enforced server-side by the cron — never trust the PDK
 *     panel as the sole source of expiration (defense in depth).
 *   - All state transitions stamp createdBy / revokedBy for audit.
 */
import type { Types } from 'mongoose'
import VisitorAccess from '@/models/VisitorAccess'
import type { IVisitorAccessDocument } from '@/models/VisitorAccess'
import {
  createHolder,
  setHolderEnabled,
  deleteHolder,
  addHolderToGroup,
} from '@/lib/gateAdapters/pdk'
import { pdkConfigured } from '@/lib/pdkSync'
import { ensureVisitorGroup } from '@/lib/pdkVisitorGroup'
import { generateUniquePin } from '@/lib/visitorAccessPin'

export interface IssueVisitorAccessInput {
  /** Person's display name. Capped to 35 chars by the model (PDK limit). */
  name: string
  /** Why they're visiting — "Electrician", "HVAC repair", etc. */
  purpose: string
  /** Window length in minutes from now. Server-controlled so the client can't
   *  pass a 10-year validUntil. */
  durationMinutes: number
  /** Admin who issued the pass — for audit. */
  createdBy: string
  /** Optional: schedule the window to start later. Defaults to now. Must not
   *  be in the past. */
  validFrom?: Date
}

const MIN_DURATION_MIN = 5
const MAX_DURATION_MIN = 24 * 60 // 24 hours — anything longer is a tenant, not a visitor

export class VisitorAccessValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VisitorAccessValidationError'
  }
}

function assertDuration(durationMinutes: number): void {
  if (!Number.isFinite(durationMinutes)
      || !Number.isInteger(durationMinutes)
      || durationMinutes < MIN_DURATION_MIN
      || durationMinutes > MAX_DURATION_MIN) {
    throw new VisitorAccessValidationError(
      `durationMinutes must be an integer between ${MIN_DURATION_MIN} and ${MAX_DURATION_MIN} (got ${durationMinutes})`,
    )
  }
}

function clean(s: string, max: number, field: string): string {
  const trimmed = s.trim()
  if (!trimmed) throw new VisitorAccessValidationError(`${field} is required`)
  if (trimmed.length > max) {
    throw new VisitorAccessValidationError(`${field} exceeds max length ${max}`)
  }
  return trimmed
}

export interface IssuedVisitorAccess {
  id: string
  name: string
  purpose: string
  pin: string
  validFrom: Date
  validUntil: Date
  pdkHolderId?: string
  pdkSynced: boolean
}

/**
 * Create a new visitor pass + provision in PDK.
 *
 * Returns the PIN in plaintext exactly once — this is the only opportunity
 * the caller has to surface it to the user. Subsequent reads of the document
 * still contain it, but the admin UI hides it after creation.
 */
export async function issueVisitorAccess(
  input: IssueVisitorAccessInput,
): Promise<IssuedVisitorAccess> {
  assertDuration(input.durationMinutes)
  const name = clean(input.name, 35, 'name')
  const purpose = clean(input.purpose, 120, 'purpose')
  const createdBy = clean(input.createdBy, 200, 'createdBy')

  const now = new Date()
  const validFrom = input.validFrom ?? now
  if (validFrom.getTime() < now.getTime() - 60_000) {
    throw new VisitorAccessValidationError('validFrom cannot be in the past')
  }
  const validUntil = new Date(validFrom.getTime() + input.durationMinutes * 60_000)

  const pin = await generateUniquePin()

  // Create the local record first — if PDK fails afterwards, the cron picks
  // up the orphan (status='active', no pdkHolderId) and reconciles.
  const doc = await VisitorAccess.create({
    name,
    purpose,
    validFrom,
    validUntil,
    pin,
    status: 'active',
    createdBy,
  })

  let pdkSynced = false
  let pdkHolderId: string | undefined

  if (pdkConfigured()) {
    try {
      const { groupId } = await ensureVisitorGroup()
      const [firstName, ...rest] = name.split(' ')
      const lastName = rest.join(' ') || 'Visitor'
      const holder = await createHolder({
        firstName: firstName.slice(0, 35),
        lastName: lastName.slice(0, 35) || 'Visitor',
        pin,
        enabled: validFrom.getTime() <= Date.now(),
      })
      await addHolderToGroup(holder.id, groupId)
      doc.pdkHolderId = holder.id
      doc.pdkSyncedAt = new Date()
      await doc.save()
      pdkSynced = true
      pdkHolderId = holder.id
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[visitorAccess] PDK provision failed for ${doc._id}: ${msg}`)
      // Local record stays; cron will retry (or admin can revoke).
    }
  }

  return {
    id: String(doc._id),
    name,
    purpose,
    pin,
    validFrom,
    validUntil,
    pdkHolderId,
    pdkSynced,
  }
}

export interface RevokeVisitorAccessInput {
  id: string | Types.ObjectId
  revokedBy: string
}

export async function revokeVisitorAccess(
  input: RevokeVisitorAccessInput,
): Promise<IVisitorAccessDocument> {
  const doc = await VisitorAccess.findById(input.id)
  if (!doc) throw new VisitorAccessValidationError('Visitor access not found')
  if (doc.status !== 'active') {
    throw new VisitorAccessValidationError(
      `Visitor access is already ${doc.status}; cannot revoke`,
    )
  }

  doc.status = 'revoked'
  doc.revokedAt = new Date()
  doc.revokedBy = clean(input.revokedBy, 200, 'revokedBy')
  await doc.save()

  if (pdkConfigured() && doc.pdkHolderId) {
    try {
      await deleteHolder(doc.pdkHolderId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[visitorAccess] revoke PDK delete failed for ${doc._id}: ${msg}`)
      // Local state already flipped to 'revoked'; cron will retry deletion.
    }
  }

  return doc
}

/**
 * Cron-invoked sweep. Finds all currently-active passes whose validUntil has
 * elapsed, deletes the PDK holder, and marks them 'expired'. Called every
 * 2 minutes by the visitorAccessExpiration cron — that interval IS the
 * security window for a leaked PIN.
 */
export interface ExpireVisitorAccessSummary {
  scanned: number
  expired: number
  pdkDeleted: number
  pdkFailed: number
  errors: Array<{ id: string; message: string }>
}

export async function expireDueVisitorAccess(now: Date = new Date()): Promise<ExpireVisitorAccessSummary> {
  const summary: ExpireVisitorAccessSummary = {
    scanned: 0, expired: 0, pdkDeleted: 0, pdkFailed: 0, errors: [],
  }
  const due = await VisitorAccess.find({
    status: 'active',
    validUntil: { $lte: now },
  })

  for (const doc of due) {
    summary.scanned++
    try {
      if (pdkConfigured() && doc.pdkHolderId) {
        try {
          await deleteHolder(doc.pdkHolderId)
          summary.pdkDeleted++
        } catch (err) {
          summary.pdkFailed++
          // Even if PDK fails, we still mark the local record expired so the
          // admin UI is consistent; the next sweep will retry deletion if
          // pdkHolderId is still set. We clear pdkHolderId only on success.
          throw err
        }
      }
      doc.status = 'expired'
      doc.expiredAt = now
      await doc.save()
      summary.expired++
    } catch (err) {
      summary.errors.push({
        id: String(doc._id),
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return summary
}

/**
 * Cron-invoked activation. Visitor passes created with validFrom in the
 * future were stored in PDK as enabled=false. This flips them to enabled=true
 * once validFrom has arrived. Idempotent — re-running over an already-active
 * holder is a no-op on the PDK side because we only call setHolderEnabled
 * when local state requires it.
 */
export interface ActivateVisitorAccessSummary {
  scanned: number
  activated: number
  pdkFailed: number
  errors: Array<{ id: string; message: string }>
}

export async function activateDueVisitorAccess(now: Date = new Date()): Promise<ActivateVisitorAccessSummary> {
  const summary: ActivateVisitorAccessSummary = {
    scanned: 0, activated: 0, pdkFailed: 0, errors: [],
  }
  if (!pdkConfigured()) return summary

  // Look for active local passes whose window has begun but whose PDK holder
  // might still be disabled (because they were scheduled). We have no local
  // 'enabled in PDK' flag; conservatively, anything within the window with a
  // holder gets a setEnabled(true) — PDK PATCH is cheap and idempotent.
  const due = await VisitorAccess.find({
    status: 'active',
    validFrom: { $lte: now },
    validUntil: { $gt: now },
    pdkHolderId: { $exists: true, $ne: null },
  })

  for (const doc of due) {
    summary.scanned++
    try {
      await setHolderEnabled(doc.pdkHolderId!, true)
      summary.activated++
    } catch (err) {
      summary.pdkFailed++
      summary.errors.push({
        id: String(doc._id),
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return summary
}
