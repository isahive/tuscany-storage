import { connectDB } from '@/lib/db'
import RateChange from '@/models/RateChange'
import Lease from '@/models/Lease'

interface RateExecutionResult {
  leaseId: string
  previousRate: number
  newRate: number
  effectiveDate: Date
}

/**
 * Apply approved rate changes whose effectiveDate has arrived.
 * Updates Lease.monthlyRate + Lease.lastRateChangeDate.
 * Marks the RateChange as 'executed'.
 */
export async function runRateExecution(): Promise<RateExecutionResult[]> {
  console.log('[RateExecution] Starting rate execution job...')
  await connectDB()

  const now = new Date()
  const dueChanges = await RateChange.find({
    status: 'approved',
    effectiveDate: { $lte: now },
  })

  console.log(`[RateExecution] Found ${dueChanges.length} approved change(s) due`)

  const results: RateExecutionResult[] = []

  for (const change of dueChanges) {
    try {
      const lease = await Lease.findById(change.leaseId)
      if (!lease || lease.status !== 'active') {
        change.status = 'executed'
        change.executedAt = now
        change.rejectionReason = (change.rejectionReason ?? '') + ' [skipped: lease inactive]'
        await change.save()
        continue
      }

      const previousRate = lease.monthlyRate
      lease.monthlyRate = change.proposedRate
      lease.lastRateChangeDate = now
      await lease.save()

      change.status = 'executed'
      change.executedAt = now
      await change.save()

      console.log(`[RateExecution] Lease ${lease._id}: ${previousRate} -> ${change.proposedRate}`)

      results.push({
        leaseId: lease._id.toString(),
        previousRate,
        newRate: change.proposedRate,
        effectiveDate: change.effectiveDate,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[RateExecution] Failed for change ${change._id}:`, msg)
    }
  }

  console.log(`[RateExecution] Complete. ${results.length} executed.`)
  return results
}
