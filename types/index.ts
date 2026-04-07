// ─── Shared TypeScript types ────────────────────────────────────────────────
// DO NOT remove types. Only add. Coordinate with Dev 1 before changing.

export type UnitType = 'standard' | 'climate_controlled' | 'drive_up' | 'vehicle_outdoor'
export type UnitFloor = 'ground' | 'upper'
export type UnitStatus = 'available' | 'occupied' | 'maintenance' | 'reserved'

export type TenantStatus = 'active' | 'delinquent' | 'locked_out' | 'moved_out'
export type TenantRole = 'tenant' | 'admin'

export type LeaseStatus = 'active' | 'ended' | 'pending_moveout'

export type PaymentType = 'rent' | 'late_fee' | 'deposit' | 'prorated' | 'other'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

export type NotificationType =
  | 'payment_reminder'
  | 'payment_confirmation'
  | 'payment_failed'
  | 'late_notice'
  | 'lockout_notice'
  | 'gate_code_changed'
  | 'move_in_confirmation'
  | 'move_out_confirmation'
  | 'rate_change_notice'
  | 'waiting_list_available'
  | 'custom'

export type NotificationChannel = 'email' | 'sms' | 'both'
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'undelivered'

export type WaitingListStatus = 'waiting' | 'notified' | 'converted' | 'expired'

// ─── API shapes ──────────────────────────────────────────────────────────────

export interface Unit {
  _id: string
  unitNumber: string
  size: string
  width: number
  depth: number
  sqft: number
  type: UnitType
  floor: UnitFloor
  price: number        // cents
  status: UnitStatus
  features: string[]
  currentTenantId?: string
  currentLeaseId?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Tenant {
  _id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  alternatePhone?: string
  alternateEmail?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  driversLicense?: string
  role: TenantRole
  gateCode?: string
  stripeCustomerId?: string
  defaultPaymentMethodId?: string
  autopayEnabled: boolean
  status: TenantStatus
  smsOptIn: boolean
  referralSource?: string
  createdAt: string
  updatedAt: string
}

export interface Lease {
  _id: string
  tenantId: string
  unitId: string
  startDate: string
  endDate?: string
  moveOutDate?: string
  monthlyRate: number  // cents
  deposit: number      // cents
  proratedFirstMonth: number  // cents
  billingDay: number
  status: LeaseStatus
  leaseDocumentUrl?: string
  signedAt?: string
  signatureData?: string
  lastRateChangeDate?: string
  createdAt: string
  updatedAt: string
}

export interface Payment {
  _id: string
  tenantId: string
  leaseId: string
  unitId: string
  stripePaymentIntentId: string
  stripeChargeId?: string
  amount: number       // cents
  currency: 'usd'
  type: PaymentType
  status: PaymentStatus
  periodStart: string
  periodEnd: string
  attemptCount: number
  lastAttemptAt?: string
  failureReason?: string
  receiptUrl?: string
  receiptEmailSentAt?: string
  createdAt: string
  updatedAt: string
}

export interface WaitingListEntry {
  _id: string
  name: string
  email: string
  phone: string
  preferredSize: string
  preferredType?: string
  desiredMoveInDate?: string
  notes?: string
  status: WaitingListStatus
  notifiedAt?: string
  notifiedUnitId?: string
  createdAt: string
  updatedAt: string
}

export type EventType = 'entry' | 'exit' | 'denied' | 'code_changed'
export type GateId = 'entrance' | 'exit' | 'unknown'
export type AccessSource = 'keypad' | 'app' | 'admin' | 'system'

export interface AccessLog {
  _id: string
  tenantId: string
  unitId?: string
  eventType: EventType
  gateId: GateId
  source: AccessSource
  ipAddress?: string
  notes?: string
  createdAt: string
}

// ─── API response wrapper ────────────────────────────────────────────────────

export type ApiSuccess<T> = { success: true; data: T }
export type ApiError = { success: false; error: string; code?: string }
export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── NextAuth session types ──────────────────────────────────────────────────

export interface SessionUser {
  id: string
  email: string
  role: TenantRole
  name: string
}
