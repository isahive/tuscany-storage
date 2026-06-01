import { Types } from 'mongoose'
import Tenant from '@/models/Tenant'
import AccessLog from '@/models/AccessLog'
import { syncTenantToPdkSafe } from '@/lib/pdkSync'

export type GateRevokeReason = 'move_out' | 'auction' | 'lease_ended' | 'manual'

/**
 * Wipes every gate-access surface for a tenant: gate code, additional cards,
 * gate groups. Records an AccessLog entry tagged with the reason and unit.
 *
 * Why a helper: move-out, auction, and the manual "Lock Out" button on the
 * Gate Access page must all behave identically — a single source of truth
 * keeps that contract enforceable.
 */
export async function revokeGateAccess(
  tenantId: Types.ObjectId | string,
  reason: GateRevokeReason,
  unitId?: Types.ObjectId | string,
) {
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: { additionalCards: [], gateGroups: [], lockedOutAt: new Date() },
    $unset: { gateCode: 1 },
  })

  await AccessLog.create({
    tenantId,
    unitId,
    eventType: 'code_changed',
    gateId: 'entrance',
    source: 'system',
    notes: `Gate access revoked (reason: ${reason}).`,
  })

  await syncTenantToPdkSafe(tenantId)
}
