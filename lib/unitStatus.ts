/**
 * Derived "display status" shown on the /admin/units grid. Mirrors the 12
 * legend chips in Storable Easy. Persisted Unit.status only has 4 values —
 * the rest (Auction, Late, Lien, …) live in lease/tenant/payment state and
 * are computed on read.
 */

export type UnitDisplayStatus =
  | 'auction'
  | 'available'
  | 'late'
  | 'lien'
  | 'locked_out'
  | 'reserved_marketplace'
  | 'moving_out'
  | 'pending'
  | 'pre_lien'
  | 'rented'
  | 'reserved'
  | 'unavailable'

/** Inputs the resolver needs — supply whatever you have, missing pieces just
 *  let earlier rules fall through. */
export interface DisplayStatusInputs {
  unitStatus: 'available' | 'occupied' | 'maintenance' | 'reserved'
  reservationSource?: 'marketplace' | 'direct' | null
  lease?: {
    status: 'active' | 'ended' | 'pending_moveout'
    auctionDate?: Date | null
    auctionScheduledAt?: Date | null
  } | null
  tenant?: {
    status: 'active' | 'delinquent' | 'locked_out' | 'moved_out'
  } | null
  /** Oldest unpaid rent line item (pending/failed). Used to size delinquency. */
  oldestUnpaid?: {
    dueDate?: Date | null
    periodEnd?: Date | null
  } | null
  hasPendingMoveOutRequest?: boolean
  /** Reference "now" — pass an override in tests. */
  now?: Date
}

// Storable's published thresholds for self-storage lien escalation in most
// states: late at 1+ days unpaid, pre-lien around 30, lien around 60.
const PRE_LIEN_DAYS = 30
const LIEN_DAYS = 60

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24))
}

export function computeDisplayStatus(input: DisplayStatusInputs): UnitDisplayStatus {
  const now = input.now ?? new Date()

  // Maintenance always trumps lease state — the unit physically can't rent.
  if (input.unitStatus === 'maintenance') return 'unavailable'

  if (input.unitStatus === 'reserved') {
    return input.reservationSource === 'marketplace' ? 'reserved_marketplace' : 'reserved'
  }

  if (input.unitStatus === 'available') return 'available'

  // From here: unit is "occupied" — derive from lease/tenant signals.
  const lease = input.lease
  const tenant = input.tenant

  // Auction scheduled — highest priority operational state.
  const auctionAt = lease?.auctionDate ?? lease?.auctionScheduledAt ?? null
  if (auctionAt) return 'auction'

  if (tenant?.status === 'locked_out') return 'locked_out'

  if (lease?.status === 'pending_moveout') return 'moving_out'
  if (input.hasPendingMoveOutRequest) return 'pending'

  // Delinquency tiers — only meaningful when there's actually an unpaid rent.
  if (input.oldestUnpaid) {
    const ref = input.oldestUnpaid.dueDate ?? input.oldestUnpaid.periodEnd ?? null
    if (ref) {
      const days = daysBetween(now, ref)
      if (days >= LIEN_DAYS) return 'lien'
      if (days >= PRE_LIEN_DAYS) return 'pre_lien'
      if (days >= 1) return 'late'
    }
  }

  return 'rented'
}

// Palette/labels — single source of truth so backend and UI agree.
export const DISPLAY_STATUS_LABELS: Record<UnitDisplayStatus, string> = {
  auction: 'Auction',
  available: 'Available',
  late: 'Late',
  lien: 'Lien',
  locked_out: 'Locked Out',
  reserved_marketplace: 'Reserved (Marketplace)',
  moving_out: 'Moving Out',
  pending: 'Pending',
  pre_lien: 'Pre-Lien',
  rented: 'Rented',
  reserved: 'Reserved',
  unavailable: 'Unavailable',
}

export const DISPLAY_STATUS_COLORS: Record<UnitDisplayStatus, { bg: string; text: string }> = {
  auction:              { bg: '#000000', text: '#FFFFFF' },
  available:            { bg: '#22A05B', text: '#FFFFFF' },
  late:                 { bg: '#E22B2B', text: '#FFFFFF' },
  lien:                 { bg: '#FACC15', text: '#1C0F06' },
  locked_out:           { bg: '#9333EA', text: '#FFFFFF' },
  reserved_marketplace: { bg: '#EC4899', text: '#FFFFFF' },
  moving_out:           { bg: '#7C2D12', text: '#FFFFFF' },
  pending:              { bg: '#D9E5C8', text: '#1C0F06' },
  pre_lien:             { bg: '#F97316', text: '#FFFFFF' },
  rented:               { bg: '#1F3CE6', text: '#FFFFFF' },
  reserved:             { bg: '#8FC8E1', text: '#1C0F06' },
  unavailable:          { bg: '#D1D5DB', text: '#1C0F06' },
}
