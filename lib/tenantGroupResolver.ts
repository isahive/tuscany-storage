import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Payment from '@/models/Payment'
import { isValidTenantGroup, type TenantGroupId } from './tenantGroups'

/**
 * Maps a Storable customer group id to a Mongo filter the /api/tenants
 * endpoint can layer on top of its search box. When the group has no
 * dimension a base filter can express (joins on Lease / Payment), we
 * resolve to an explicit `_id: { $in: [...] }` set so the rest of the
 * query stays composable.
 *
 * Returns `null` to mean "no group filter" (caller uses the base filter
 * only). Returns `{}` to mean "ALWAYS empty" — currently unused; the
 * fallback for an unknown group id.
 */
export async function buildTenantGroupFilter(
  rawGroup: string | null | undefined,
): Promise<Record<string, unknown> | null> {
  if (!rawGroup || rawGroup === 'all') return null
  if (!isValidTenantGroup(rawGroup)) return null

  const group = rawGroup as TenantGroupId

  switch (group) {
    case 'active':
      // Storable's "Active" group is every tenant that ever rented — i.e.
      // anything with role=tenant + not archived. We mirror that.
      return { role: 'tenant', archived: { $ne: true } }

    case 'current': {
      const ids = await activeLeaseTenantIds()
      return { _id: { $in: ids } }
    }

    case 'recurring':
      return { autopayEnabled: true }

    case 'non_recurring': {
      const ids = await activeLeaseTenantIds()
      return { _id: { $in: ids }, autopayEnabled: { $ne: true } }
    }

    case 'outstanding':
      return { balance: { $gt: 0 } }

    case 'past_due': {
      const ids = await pastDueTenantIds()
      return { _id: { $in: ids } }
    }

    case 'late':
      return { status: 'delinquent' }

    case 'locked_out':
      return { status: 'locked_out' }

    case 'auction_date_set': {
      const ids = await auctionScheduledTenantIds()
      return { _id: { $in: ids } }
    }

    case 'waiting_list':
      return { onWaitingList: true }

    case 'late_fee_exempt':
      return { lateFeeExempt: true }

    case 'tax_exempt':
      return { taxExempt: true }

    case 'tenant_protection_plans':
    case 'active_insurance_policies': {
      // Storable distinguishes facility-run protection plans from third-party
      // insurance policies. We don't yet model insurance separately, so both
      // groups resolve through the same source until that's added.
      const ids = await protectionPlanTenantIds()
      return { _id: { $in: ids } }
    }

    case 'tenant_protection_eligible': {
      const ids = await tppEligibleTenantIds()
      return { _id: { $in: ids } }
    }

    case 'automatic_lockout_disabled':
      return { automaticLockoutEnabled: false }

    default:
      return null
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function activeLeaseTenantIds(): Promise<string[]> {
  const leases = await Lease.find({ status: { $in: ['active', 'pending_moveout'] } })
    .select('tenantId').lean<Array<{ tenantId: any }>>()
  return [...new Set(leases.map((l) => String(l.tenantId)))]
}

async function pastDueTenantIds(): Promise<string[]> {
  const now = new Date()
  const rows = await Payment.find({
    type: 'rent',
    status: 'pending',
    direction: 'charge',
    dueDate: { $lt: now },
  }).select('tenantId').lean<Array<{ tenantId: any }>>()
  return [...new Set(rows.map((r) => String(r.tenantId)))]
}

async function auctionScheduledTenantIds(): Promise<string[]> {
  const leases = await Lease.find({
    status: { $in: ['active', 'pending_moveout'] },
    auctionDate: { $ne: null },
  }).select('tenantId').lean<Array<{ tenantId: any }>>()
  return [...new Set(leases.map((l) => String(l.tenantId)))]
}

async function protectionPlanTenantIds(): Promise<string[]> {
  const leases = await Lease.find({
    status: { $in: ['active', 'pending_moveout'] },
    protectionPlanId: { $ne: null },
  }).select('tenantId').lean<Array<{ tenantId: any }>>()
  return [...new Set(leases.map((l) => String(l.tenantId)))]
}

async function tppEligibleTenantIds(): Promise<string[]> {
  // Active renters whose active lease does NOT have a protectionPlanId set.
  const leases = await Lease.find({
    status: { $in: ['active', 'pending_moveout'] },
    $or: [{ protectionPlanId: null }, { protectionPlanId: { $exists: false } }],
  }).select('tenantId').lean<Array<{ tenantId: any }>>()
  return [...new Set(leases.map((l) => String(l.tenantId)))]
}
