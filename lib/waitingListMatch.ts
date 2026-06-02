/**
 * When a unit becomes available (move-out approved, or admin manually flips
 * to 'available'), find the first matching waiting-list entry and notify it.
 *
 * Match rule: status='waiting' AND preferredSize == unit.size AND, when the
 * entry specifies a preferredType, it equals unit.type. We sort by createdAt
 * ASC so the longest-waiting prospect gets first crack (fairness).
 *
 * The actual notification dispatch goes through the same /notify route used
 * by the admin button — we call it as a function rather than HTTP'ing back
 * to ourselves to keep one code path. The route is fire-and-forget from this
 * caller's perspective: failures log but never block the move-out flow.
 */
import WaitingList from '@/models/WaitingList'
import type { IUnitDocument } from '@/models/Unit'
import { sendEmail } from '@/lib/email'
import { sendSMS } from '@/lib/twilio'

interface UnitForMatch {
  _id: unknown
  unitNumber?: string
  size?: string
  type?: string
}

export interface MatchResult {
  matched: boolean
  entryId?: string
  emailDispatched?: boolean
  smsDispatched?: boolean
  error?: string
}

/**
 * Try to notify the next waiting-list entry whose preference matches `unit`.
 * Never throws — always returns a structured result the caller can log.
 */
export async function notifyFirstMatchingWaitingListEntry(
  unit: UnitForMatch | Pick<IUnitDocument, '_id' | 'unitNumber' | 'size' | 'type'> | null,
): Promise<MatchResult> {
  if (!unit?.size) return { matched: false }

  try {
    const candidates = await WaitingList.find({
      status: 'waiting',
      preferredSize: unit.size,
    }).sort({ createdAt: 1 })

    const match = candidates.find(
      (c) => !c.preferredType || c.preferredType === unit.type,
    )
    if (!match) return { matched: false }

    const subject = unit.unitNumber
      ? `Unit ${unit.unitNumber} is now available`
      : `A unit matching your request is now available`
    const message =
      `Hi ${match.name},\n\n` +
      (unit.unitNumber
        ? `Good news — unit ${unit.unitNumber}${unit.size ? ` (${unit.size})` : ''} just opened up and matches what you asked for.`
        : `Good news — a unit that matches what you asked for just opened up.`) +
      `\n\nReply to this message or call us to claim it before someone else does.`
    const html = `<p>${message.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`

    let emailDispatched = false
    let smsDispatched = false

    if (match.email) {
      try {
        await sendEmail(match.email, subject, html)
        emailDispatched = true
      } catch (err) {
        console.error('[waitingListMatch] email failed:', err)
      }
    }
    if (match.phone && match.smsOptIn) {
      try {
        await sendSMS(match.phone, message)
        smsDispatched = true
      } catch (err) {
        console.error('[waitingListMatch] sms failed:', err)
      }
    }

    match.status = 'notified'
    match.notifiedAt = new Date()
    match.notifiedUnitId = unit._id as any
    await match.save()

    return {
      matched: true,
      entryId: String(match._id),
      emailDispatched,
      smsDispatched,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[waitingListMatch] failed:', error)
    return { matched: false, error }
  }
}
