import { Types } from 'mongoose'

// ============ Enums / Literal Types ============

export type TenantStatus = 'active' | 'delinquent' | 'locked_out' | 'moved_out'
export type TenantRole = 'tenant' | 'admin'
export type UnitStatus = 'available' | 'occupied' | 'maintenance' | 'reserved'
export type UnitType = 'standard' | 'climate_controlled' | 'drive_up' | 'vehicle_outdoor'
export type UnitFloor = 'ground' | 'upper'
export type LeaseStatus = 'active' | 'ended' | 'pending_moveout'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'
export type PaymentType = 'rent' | 'late_fee' | 'deposit' | 'prorated' | 'other'
export type EventType = 'entry' | 'exit' | 'denied' | 'code_changed'
export type AccessEventType = EventType
export type GateId = 'entrance' | 'exit' | 'unknown'
export type AccessSource = 'keypad' | 'app' | 'admin' | 'system'

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

// ============ Backend Document Interfaces (Mongoose) ============

export interface ITenant {
  _id: Types.ObjectId
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
  password: string
  role: TenantRole
  gateCode?: string
  stripeCustomerId?: string
  defaultPaymentMethodId?: string
  autopayEnabled: boolean
  status: TenantStatus
  smsOptIn: boolean
  referralSource?: string
  createdAt: Date
  updatedAt: Date
}

export interface IUnit {
  _id: Types.ObjectId
  unitNumber: string
  size: string
  width: number
  depth: number
  sqft: number
  type: UnitType
  floor: UnitFloor
  price: number
  status: UnitStatus
  features: string[]
  currentTenantId?: Types.ObjectId
  currentLeaseId?: Types.ObjectId
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface ILease {
  _id: Types.ObjectId
  tenantId: Types.ObjectId
  unitId: Types.ObjectId
  startDate: Date
  endDate?: Date
  moveOutDate?: Date
  monthlyRate: number
  deposit: number
  proratedFirstMonth: number
  billingDay: number
  status: LeaseStatus
  leaseDocumentUrl?: string
  signedAt?: Date
  signatureData?: string
  lastRateChangeDate?: Date
  createdAt: Date
  updatedAt: Date
}

export interface IPayment {
  _id: Types.ObjectId
  tenantId: Types.ObjectId
  leaseId: Types.ObjectId
  unitId: Types.ObjectId
  stripePaymentIntentId: string
  stripeChargeId?: string
  amount: number
  currency: 'usd'
  type: PaymentType
  status: PaymentStatus
  periodStart: Date
  periodEnd: Date
  attemptCount: number
  lastAttemptAt?: Date
  failureReason?: string
  receiptUrl?: string
  receiptEmailSentAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface IAccessLog {
  _id: Types.ObjectId
  tenantId: Types.ObjectId
  unitId?: Types.ObjectId
  eventType: AccessEventType
  gateId: GateId
  source: AccessSource
  ipAddress?: string
  notes?: string
  createdAt: Date
}

export interface INotification {
  _id: Types.ObjectId
  tenantId: Types.ObjectId
  type: NotificationType
  channel: NotificationChannel
  subject?: string
  body: string
  status: NotificationStatus
  sentAt?: Date
  failureReason?: string
  twilioMessageSid?: string
  sendgridMessageId?: string
  createdAt: Date
  updatedAt: Date
}

export interface IWaitingList {
  _id: Types.ObjectId
  name: string
  email: string
  phone: string
  preferredSize: string
  preferredType?: string
  desiredMoveInDate?: Date
  notes?: string
  status: WaitingListStatus
  notifiedAt?: Date
  notifiedUnitId?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

// ============ Frontend API Interfaces (serialized JSON) ============

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

// ============ API Response Types ============

export type ApiSuccess<T> = { success: true; data: T }
export type ApiError = { success: false; error: string; code?: string }
export type ApiResponse<T> = ApiSuccess<T> | ApiError

// Backend aliases
export type ApiSuccessResponse<T> = ApiSuccess<T>
export type ApiErrorResponse = ApiError

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>

// ============ Dashboard Types ============

export interface DashboardStats {
  occupancyRate: number
  totalRevenue: number
  availableUnits: number
  delinquentCount: number
  lockedOutCount: number
  recurringBillingRate: number
  waitingListCount: number
  upcomingMoveOuts: number
}

// ============ NextAuth Extensions ============

export interface SessionUser {
  id: string
  email: string
  role: TenantRole
  name: string
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: TenantRole
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: TenantRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: TenantRole
  }
}
