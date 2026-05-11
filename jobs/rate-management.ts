import { connectDB } from '@/lib/db'
import Unit from '@/models/Unit'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import RateChange from '@/models/RateChange'
import { formatMoney } from '@/lib/utils'
import type { IUnitDocument } from '@/models/Unit'
import type { ILeaseDocument } from '@/models/Lease'
import type { ITenantDocument } from '@/models/Tenant'

const isDev = process.env.NODE_ENV === 'development'
const RATE_INCREASE_PERCENT = 0.05 // 5%
const MIN_TENURE_MONTHS = 12
const MIN_MONTHS_SINCE_RATE_CHANGE = 12
const ADVANCE_NOTICE_DAYS = 30

export interface RateChangeProposal {
  tenantId: string
  tenantEmail: string
  tenantName: string
  leaseId: string
  unitId: string
  unitNumber: string
  unitType: string
  currentRate: number
  proposedRate: number
  increaseAmount: number
  increasePercent: number
  tenureMonths: number
  occupancyRate: number
  effectiveDate: Date
  notificationCreated: boolean
}

/**
 * Round up to nearest dollar (nearest 100 cents).
 */
function roundUpToNearestDollar(cents: number): number {
  return Math.ceil(cents / 100) * 100
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

export async function runRateManagement(): Promise<RateChangeProposal[]> {
  console.log('[RateManagement] Starting rate increase automation...')
  await connectDB()

  const now = new Date()
  const proposals: RateChangeProposal[] = []

  // Step 1: Calculate occupancy by unit type
  const allUnits = await Unit.find() as IUnitDocument[]
  const occupancyByType: Record<string, { total: number; occupied: number; rate: number }> = {}

  for (const unit of allUnits) {
    if (!occupancyByType[unit.type]) {
      occupancyByType[unit.type] = { total: 0, occupied: 0, rate: 0 }
    }
    occupancyByType[unit.type].total++
    if (unit.status === 'occupied') {
      occupancyByType[unit.type].occupied++
    }
  }

  // Calculate rates
  for (const type of Object.keys(occupancyByType)) {
    const data = occupancyByType[type]
    data.rate = data.total > 0 ? (data.occupied / data.total) * 100 : 0
  }

  console.log('[RateManagement] Occupancy by unit type:')
  for (const [type, data] of Object.entries(occupancyByType)) {
    console.log(`  ${type}: ${data.occupied}/${data.total} (${data.rate.toFixed(1)}%)`)
  }

  // Step 2: Find unit types with >= 90% occupancy
  const highOccupancyTypes = Object.entries(occupancyByType)
    .filter(([, data]) => data.rate >= 90)
    .map(([type]) => type)

  if (highOccupancyTypes.length === 0) {
    console.log('[RateManagement] No unit types at >= 90% occupancy. No rate increases to propose.')
    return proposals
  }

  console.log(`[RateManagement] High occupancy types (>= 90%): ${highOccupancyTypes.join(', ')}`)

  // Step 3: Find eligible leases — active, >= 12 months tenure, no rate change in 12 months
  const activeLeases = await Lease.find({ status: 'active' }) as ILeaseDocument[]

  for (const lease of activeLeases) {
    try {
      // Check tenure >= 12 months
      const tenureMonths = monthsBetween(new Date(lease.startDate), now)
      if (tenureMonths < MIN_TENURE_MONTHS) {
        continue
      }

      // Check no rate change in last 12 months
      if (lease.lastRateChangeDate) {
        const monthsSinceRateChange = monthsBetween(new Date(lease.lastRateChangeDate), now)
        if (monthsSinceRateChange < MIN_MONTHS_SINCE_RATE_CHANGE) {
          continue
        }
      }

      // Get unit and check if its type qualifies
      const unit = await Unit.findById(lease.unitId) as IUnitDocument | null
      if (!unit || !highOccupancyTypes.includes(unit.type)) {
        continue
      }

      // Get tenant
      const tenant = await Tenant.findById(lease.tenantId) as ITenantDocument | null
      if (!tenant || tenant.status === 'moved_out') {
        continue
      }

      // Calculate proposed rate: 5% increase rounded up to nearest dollar
      const rawIncrease = lease.monthlyRate * RATE_INCREASE_PERCENT
      const proposedRate = roundUpToNearestDollar(lease.monthlyRate + rawIncrease)
      const increaseAmount = proposedRate - lease.monthlyRate
      const increasePercent = (increaseAmount / lease.monthlyRate) * 100

      // Effective date: 30 days from now
      const effectiveDate = new Date(now)
      effectiveDate.setDate(effectiveDate.getDate() + ADVANCE_NOTICE_DAYS)

      const occupancyRate = occupancyByType[unit.type].rate

      console.log(`[RateManagement] Proposing rate increase for ${tenant.email}:`)
      console.log(`  Unit: ${unit.unitNumber} (${unit.type})`)
      console.log(`  Current: ${formatMoney(lease.monthlyRate)} -> Proposed: ${formatMoney(proposedRate)} (+${formatMoney(increaseAmount)}, ${increasePercent.toFixed(1)}%)`)
      console.log(`  Tenure: ${tenureMonths} months, Occupancy: ${occupancyRate.toFixed(1)}%`)

      // Persist as proposal — admin must approve before tenant is notified
      let notificationCreated = false
      try {
        const existing = await RateChange.findOne({
          leaseId: lease._id,
          status: { $in: ['proposed', 'approved'] },
        })
        if (existing) {
          console.log(`[RateManagement] Existing open proposal for lease ${lease._id}, skipping`)
          continue
        }

        await RateChange.create({
          tenantId: tenant._id,
          leaseId: lease._id,
          unitId: unit._id,
          currentRate: lease.monthlyRate,
          proposedRate,
          effectiveDate,
          status: 'proposed',
          occupancyRate,
          tenureMonths,
        })
        notificationCreated = true
      } catch (err: any) {
        console.error(`[RateManagement] Error persisting proposal for ${tenant.email}:`, err.message)
      }

      proposals.push({
        tenantId: tenant._id.toString(),
        tenantEmail: tenant.email,
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        leaseId: lease._id.toString(),
        unitId: unit._id.toString(),
        unitNumber: unit.unitNumber,
        unitType: unit.type,
        currentRate: lease.monthlyRate,
        proposedRate,
        increaseAmount,
        increasePercent,
        tenureMonths,
        occupancyRate,
        effectiveDate,
        notificationCreated,
      })
    } catch (err: any) {
      console.error(`[RateManagement] Error evaluating lease ${lease._id}:`, err.message)
    }
  }

  console.log(`\n[RateManagement] Complete. ${proposals.length} rate increase(s) proposed for admin approval.`)

  if (isDev && proposals.length > 0) {
    console.log('\n[RateManagement] Proposed changes summary:')
    proposals.forEach((p) => {
      console.log(`  ${p.tenantName} (${p.tenantEmail}) - Unit ${p.unitNumber}`)
      console.log(`    ${formatMoney(p.currentRate)} -> ${formatMoney(p.proposedRate)} (+${p.increasePercent.toFixed(1)}%)`)
      console.log(`    Effective: ${p.effectiveDate.toLocaleDateString('en-US')}`)
    })
  }

  return proposals
}
