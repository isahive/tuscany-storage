import { connectDB } from '@/lib/db'
import { getSettings } from '@/lib/getSettings'
import { sendEmail } from '@/lib/email'
import LockoutEvent from '@/models/LockoutEvent'

/**
 * Storable's overnight "Lock Out Report" email. Summarizes the previous
 * 24-hour window of lockout/unlock events and sends one digest to the
 * notifications email. Skips entirely when there's no activity so admins
 * don't get an empty mail every morning.
 *
 * The HTML mirrors the Storable layout: separate sections for "Lock-Outs"
 * (locked_out) and "Lock-Out Removals" (unlocked), each showing whether the
 * row is pending approval (when the lockoutRequireApproval* flags are on).
 */
export async function runLockoutReportEmail(): Promise<{ sent: boolean; count: number }> {
  await connectDB()
  const settings = await getSettings()

  const to = settings.notificationEmail || settings.facilityEmail
  if (!to) return { sent: false, count: 0 }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rows = await LockoutEvent.find({ createdAt: { $gte: since } })
    .populate('tenantId', 'firstName lastName')
    .populate('unitId', 'unitNumber')
    .sort({ createdAt: -1 })
    .lean<Array<any>>()

  if (rows.length === 0) return { sent: false, count: 0 }

  const lockOuts = rows.filter((r) => r.type === 'locked_out')
  const unlocks = rows.filter((r) => r.type === 'unlocked')

  const renderRow = (r: any) => {
    const name = r.tenantId ? `${r.tenantId.firstName} ${r.tenantId.lastName}` : 'Unknown tenant'
    const unit = r.unitId?.unitNumber ? `Unit ${r.unitId.unitNumber}` : ''
    const when = new Date(r.createdAt).toLocaleString('en-US')
    const status = r.approvedAt
      ? `Approved by ${r.approvedBy ?? 'system'}`
      : 'Not Approved'
    return `<li>${name}${unit ? ` — ${unit}` : ''} · ${when} · ${status}</li>`
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const html = `
    <p>Hi,</p>
    <p>Here is the Lock Out activity for the past 24 hours at <strong>${settings.facilityName ?? 'your facility'}</strong>.</p>

    ${lockOuts.length > 0 ? `<h3>Lock-Outs (${lockOuts.length})</h3><ul>${lockOuts.map(renderRow).join('')}</ul>` : '<p>No new lock-outs.</p>'}

    ${unlocks.length > 0 ? `<h3>Lock-Out Removals (${unlocks.length})</h3><ul>${unlocks.map(renderRow).join('')}</ul>` : '<p>No new lock-out removals.</p>'}

    <p><a href="${appUrl}/admin/reports/lock-out">Open the Lock Out Report</a> to review and approve pending changes.</p>
  `

  await sendEmail(to, 'Lock Out Report — Past 24 Hours', html)
  return { sent: true, count: rows.length }
}
