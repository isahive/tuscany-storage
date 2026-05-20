import mongoose, { Schema, Document } from 'mongoose'

export interface ISettingsDocument extends Document {
  // ── Facility ──────────────────────────────────────────────────────────────
  facilityName: string
  facilityAddress: string
  facilityCity: string
  facilityState: string
  facilityZip: string
  facilityPhone: string
  facilityEmail: string
  accessHoursStart: string
  accessHoursEnd: string

  // ── Locale ────────────────────────────────────────────────────────────────
  locale: string         // 'en-US'
  currency: string       // 'USD'
  dateFormat: string     // 'MM/DD/YYYY'
  timeZone: string       // 'America/New_York'
  phoneFormat: string    // '(555) 555-5555'
  dimensionFormat: string // '10w x 10l x 10h'

  // ── Tax ──────────────────────────────────────────────────────────────────
  taxRate: number               // sales tax percentage (e.g. 9.75)

  // ── Billing ───────────────────────────────────────────────────────────────
  billingDaysBeforeDue: number  // days before due date billing is generated (default 7)
  daysRequiredBeforeBillingDay: number // default 0

  // ── Billing Cycle ─────────────────────────────────────────────────────────
  billingCycleAnchor: 'first_of_month' | 'signup_day' | 'custom_day'
  billingCycleCustomDay: number  // 1-28, only used when anchor is 'custom_day'

  // ── Proration Model ───────────────────────────────────────────────────────
  prorationModel: 'none' | 'custom' | 'first_month_full_prorate_now' | 'first_month_full_then_prorate' | 'prorate_first_month' | 'prorate_both'
  prorationDaysBasis: 'actual_days_in_month' | 'thirty_day_month'

  // ── Fees (cents) ─────────────────────────────────────────────────────────
  lateFeeAfterDays: number
  lateFeeAmount: number
  lateFeeName: string
  lateFeeDescription: string
  nsfFeeAmount: number
  nsfFeeName: string
  nsfFeeDescription: string
  auctionFeeAmount: number
  auctionFeeName: string
  auctionFeeDescription: string
  setupFeeAmount: number
  setupFeeName: string
  setupFeeDescription: string

  // ── Rental options ────────────────────────────────────────────────────────
  enablePrepay: boolean
  disablePartialPaymentsForLockedOut: boolean
  saveUnpaidRentals: boolean
  autoAcknowledgeRentals: boolean
  enableAdditionalDeposits: boolean
  customerRentalProrating: boolean    // prorate second month
  defaultProratingForManagerRentals: boolean

  // ── Reservations ──────────────────────────────────────────────────────────
  enableReservations: boolean
  reservationLimitDays: number  // days in future allowed (0 = unlimited)

  // ── Customer permissions ──────────────────────────────────────────────────
  customersCanEditProfile: boolean
  customersCanEditBilling: boolean
  customersCanScheduleMoveOuts: boolean

  // ── New renter instructions ───────────────────────────────────────────────
  newRenterInstructions: string

  // ── Lockout approval ──────────────────────────────────────────────────────
  lockoutRequireApprovalAuto: boolean   // auto (paid full balance)
  lockoutRequireApprovalManual: boolean // manual (manager removed)

  // ── Fees (all stored here — including system fees flagged with `code`) ───
  customFees: Array<{
    id: string
    code?: string  // 'late' | 'nsf' | 'auction' for system-managed fees
    name: string
    amount: number // cents
    description: string
    active: boolean
  }>

  // Number of calendar days between the auction event firing and the auction
  // itself. Storable parity — formerly hardcoded to 14 in jobs/delinquency.ts.
  auctionGracePeriodDays: number

  // Storable's "Automatic Auction Dates" config — sits on the Locked Out
  // rule. When a tenant is locked out, the system stamps the auction date
  // either as `lockedOutAt + auctionDaysAfterLockout` OR as
  // `auctionFixedDate` when the admin pinned a specific calendar date.
  // Set days=0 to disable automatic scheduling entirely.
  auctionDaysAfterLockout: number
  auctionFixedDate?: Date | null

  // ── Reservation fees (per unit type) ───────────────────────────────────
  // Storable Easy charges a one-time reservation fee at the moment a unit is
  // reserved (online or in office). The fee is credited back against the
  // first rental invoice when the reservation converts. Fee is configured
  // per unit type — leave a unit type out (or amount = 0) to disable.
  unitTypeReservationFees: Array<{
    unitType: string
    amount: number   // cents
  }>

  // ── Rate Management ────────────────────────────────────────────────────
  // Storable's Rate Management suggests price changes; it never auto-applies
  // them. Two independent rule sets:
  //   - unitTypePriceRules govern STREET rates by occupancy.
  //   - rentalPriceRules govern existing tenant rates by months-since-last-change.
  rateManagementEnabled: boolean
  // Day-of-month (1–28) the admin receives the monthly reminder email.
  rateManagementReminderDay: number
  // Global options applied when computing rental rule suggestions.
  rentalPriceAdvanceNoticeDays: number
  rentalPriceAllowExceedingStreetRate: boolean
  rentalPriceRoundToNearestDollar: boolean
  // Per-unit-type rules. At most one per unit type — enforced by zod refine.
  unitTypePriceRules: Array<{
    id: string
    unitType: string
    increaseAmount?: number  // cents (one of increaseAmount/increasePercent)
    increasePercent?: number
    minOccupancyPct: number
    roundingRule: 'none' | 'nearest_dollar'
  }>
  rentalPriceRules: Array<{
    id: string
    unitType: string
    increaseAmount?: number  // cents
    increasePercent?: number
    minMonthsSinceLastChange: number
  }>

  // ── Late / Lien escalation events ──────────────────────────────────────
  lateLienEvents: Array<{
    id: string
    status: 'late' | 'locked_out' | 'pre_lien' | 'lien' | 'auction'
    daysPastDue: number
    notifyEmail: boolean
    notifyText: boolean
    notifyLetter: boolean
    notificationTemplate: string
    fees: Array<{ name: string; amount: number }>
    actions: string[]
  }>

  // ── Gate ──────────────────────────────────────────────────────────────────
  gateAutoAssign: boolean
  gateAutoAssignMethod: 'phone_last4' | 'random'
  gateCodeLength: number
  gateAutoLockout: boolean
  gateTextToOpen: boolean
  gateTextToOpenNumber: string
  gateControllerType: string
  gateNodeId: string
  gateApiEndpoint: string
  gateApiKey: string

  // ── Communication ─────────────────────────────────────────────────────────
  notificationEmail: string
  replyToEmail: string
  fromDisplayName: string
  reminderDaysBefore: number       // 0–20, days before due to send reminder
  textOnCreditWithoutPayment: boolean
  textOnOnlineRental: boolean
  printInvoiceReminders: boolean
  printFormat: 'letter' | 'postcard'
  invoiceHeader: string
  /** Full-width logo banner shown at the top of every tenant-facing email.
   *  Defaults to the bundled /images/brand/logo.png when blank. */
  emailLogoUrl?: string

  // ── Agreement ─────────────────────────────────────────────────────────────
  agreementTitle: string
  agreementTemplate: string

  // ── Customer form field settings ────────────────────────────────────────
  customerFormFields: Array<{
    key: string          // field identifier e.g. 'address', 'driversLicense'
    label: string        // display name
    showOnSignup: boolean
    requiredOnSignup: boolean
    showOnWaitingList: boolean
    requiredOnWaitingList: boolean
    isCustom: boolean    // true = admin-created field
    order: number        // display order
    fieldType?: 'text' | 'select' | 'checkbox'
    options?: string[]
    helpText?: string
  }>

  createdAt: Date
  updatedAt: Date
}

const SettingsSchema = new Schema<ISettingsDocument>(
  {
    // Facility
    facilityName:    { type: String, default: 'Tuscany Village Self Storage' },
    facilityAddress: { type: String, default: '' },
    facilityCity:    { type: String, default: '' },
    facilityState:   { type: String, default: 'TN' },
    facilityZip:     { type: String, default: '' },
    facilityPhone:   { type: String, default: '(865) 426-2100' },
    facilityEmail:   { type: String, default: '' },
    accessHoursStart: { type: String, default: '05:00' },
    accessHoursEnd:   { type: String, default: '22:00' },

    // Locale
    locale:          { type: String, default: 'en-US' },
    currency:        { type: String, default: 'USD' },
    dateFormat:      { type: String, default: 'MM/DD/YYYY' },
    timeZone:        { type: String, default: 'America/New_York' },
    phoneFormat:     { type: String, default: '(555) 555-5555' },
    dimensionFormat: { type: String, default: '10w x 10l x 10h' },

    // Tax
    taxRate: { type: Number, default: 9.75 },

    // Billing
    billingDaysBeforeDue:        { type: Number, default: 7 },
    daysRequiredBeforeBillingDay: { type: Number, default: 0 },

    // Billing Cycle
    billingCycleAnchor: {
      type: String,
      enum: ['first_of_month', 'signup_day', 'custom_day'],
      default: 'first_of_month',
    },
    billingCycleCustomDay: { type: Number, default: 1, min: 1, max: 28 },

    // Proration Model
    prorationModel: {
      type: String,
      enum: ['none', 'custom', 'first_month_full_prorate_now', 'first_month_full_then_prorate', 'prorate_first_month', 'prorate_both'],
      default: 'first_month_full_then_prorate',
    },
    prorationDaysBasis: {
      type: String,
      enum: ['actual_days_in_month', 'thirty_day_month'],
      default: 'actual_days_in_month',
    },

    // Fees
    lateFeeAfterDays:      { type: Number, default: 5 },
    lateFeeAmount:         { type: Number, default: 2000 },
    lateFeeName:           { type: String, default: 'Late Fee' },
    lateFeeDescription:    { type: String, default: '' },
    nsfFeeAmount:          { type: Number, default: 3500 },
    nsfFeeName:            { type: String, default: 'NSF / Returned Check Fee' },
    nsfFeeDescription:     { type: String, default: 'Non-sufficient funds or returned check' },
    auctionFeeAmount:      { type: Number, default: 5000 },
    auctionFeeName:        { type: String, default: 'Auction / Sale Fee' },
    auctionFeeDescription: { type: String, default: 'Lien sale processing fee' },
    setupFeeAmount:        { type: Number, default: 0 },
    setupFeeName:          { type: String, default: 'Setup Fee' },
    setupFeeDescription:   { type: String, default: '' },

    // Rental options
    enablePrepay:                       { type: Boolean, default: false },
    disablePartialPaymentsForLockedOut: { type: Boolean, default: false },
    saveUnpaidRentals:                  { type: Boolean, default: false },
    autoAcknowledgeRentals:             { type: Boolean, default: false },
    enableAdditionalDeposits:           { type: Boolean, default: false },
    customerRentalProrating:            { type: Boolean, default: false },
    defaultProratingForManagerRentals:  { type: Boolean, default: false },

    // Reservations
    enableReservations:   { type: Boolean, default: false },
    reservationLimitDays: { type: Number, default: 0 },

    // Customer permissions
    customersCanEditProfile:      { type: Boolean, default: true },
    customersCanEditBilling:      { type: Boolean, default: true },
    customersCanScheduleMoveOuts: { type: Boolean, default: true },

    // New renter instructions
    newRenterInstructions: {
      type: String,
      default:
        'Gate LOCKS at 10:00 p.m. and will not open in or out. If you find yourself locked in the facility after 10PM, call (865) 426-2100 to be let out remotely.',
    },

    // Lockout approval
    lockoutRequireApprovalAuto:   { type: Boolean, default: false },
    lockoutRequireApprovalManual: { type: Boolean, default: false },

    // All fees (system + admin-defined) — `code` tags system-managed entries.
    customFees: {
      type: [{
        id:          { type: String, required: true },
        code:        { type: String },
        name:        { type: String, required: true },
        amount:      { type: Number, required: true },
        description: { type: String, default: '' },
        active:      { type: Boolean, default: true },
      }],
      default: [],
    },

    auctionGracePeriodDays: { type: Number, default: 14, min: 0 },
    auctionDaysAfterLockout: { type: Number, default: 30, min: 0 },
    auctionFixedDate:        { type: Date, default: null },

    // Reservation fees (per unit type)
    unitTypeReservationFees: {
      type: [{
        unitType: { type: String, required: true },
        amount:   { type: Number, required: true, min: 0, default: 0 },
      }],
      default: [],
    },

    // Rate Management
    rateManagementEnabled: { type: Boolean, default: false },
    rateManagementReminderDay: { type: Number, default: 1, min: 1, max: 28 },
    rentalPriceAdvanceNoticeDays: { type: Number, default: 30, min: 0 },
    rentalPriceAllowExceedingStreetRate: { type: Boolean, default: false },
    rentalPriceRoundToNearestDollar: { type: Boolean, default: true },
    unitTypePriceRules: {
      type: [{
        id:                { type: String, required: true },
        unitType:          { type: String, required: true },
        increaseAmount:    { type: Number },
        increasePercent:   { type: Number },
        minOccupancyPct:   { type: Number, required: true },
        roundingRule:      { type: String, enum: ['none', 'nearest_dollar'], default: 'nearest_dollar' },
      }],
      default: [],
    },
    rentalPriceRules: {
      type: [{
        id:                       { type: String, required: true },
        unitType:                 { type: String, required: true },
        increaseAmount:           { type: Number },
        increasePercent:          { type: Number },
        minMonthsSinceLastChange: { type: Number, required: true },
      }],
      default: [],
    },

    // Late / Lien escalation events
    lateLienEvents: {
      type: [{
        id:                   { type: String, required: true },
        status:               { type: String, enum: ['late', 'locked_out', 'pre_lien', 'lien', 'auction'], required: true },
        daysPastDue:          { type: Number, required: true },
        notifyEmail:          { type: Boolean, default: false },
        notifyText:           { type: Boolean, default: false },
        notifyLetter:         { type: Boolean, default: false },
        notificationTemplate: { type: String, default: '' },
        fees:                 { type: [{ name: String, amount: Number }], default: [] },
        actions:              { type: [String], default: [] },
      }],
      default: [],
    },

    // Gate
    gateAutoAssign:       { type: Boolean, default: true },
    gateAutoAssignMethod: { type: String, enum: ['phone_last4', 'random'], default: 'phone_last4' },
    gateCodeLength:       { type: Number, default: 4 },
    gateAutoLockout:      { type: Boolean, default: true },
    gateTextToOpen:       { type: Boolean, default: false },
    gateTextToOpenNumber: { type: String, default: '' },
    gateControllerType:   { type: String, default: '' },
    gateNodeId:           { type: String, default: '' },
    gateApiEndpoint:      { type: String, default: '' },
    gateApiKey:           { type: String, default: '' },

    // Communication
    notificationEmail:          { type: String, default: '' },
    replyToEmail:               { type: String, default: '' },
    fromDisplayName:            { type: String, default: '' },
    reminderDaysBefore:         { type: Number, default: 3 },
    textOnCreditWithoutPayment: { type: Boolean, default: false },
    textOnOnlineRental:         { type: Boolean, default: false },
    printInvoiceReminders:      { type: Boolean, default: false },
    printFormat:                { type: String, enum: ['letter', 'postcard'], default: 'letter' },
    invoiceHeader:              { type: String, default: '' },
    emailLogoUrl:               { type: String, default: '' },

    // Agreement
    agreementTitle:    { type: String, default: 'Storage Lease Agreement' },
    agreementTemplate: { type: String, default: '' },

    // Customer form field settings
    customerFormFields: {
      type: [{
        key:                   { type: String, required: true },
        label:                 { type: String, required: true },
        showOnSignup:          { type: Boolean, default: true },
        requiredOnSignup:      { type: Boolean, default: false },
        showOnWaitingList:     { type: Boolean, default: false },
        requiredOnWaitingList: { type: Boolean, default: false },
        isCustom:              { type: Boolean, default: false },
        order:                 { type: Number, default: 0 },
        fieldType:             { type: String, enum: ['text', 'select', 'checkbox'], default: 'text' },
        options:               { type: [String], default: [] },
        helpText:              { type: String, default: '' },
      }],
      default: [],
    },
  },
  { timestamps: true },
)

export default mongoose.models.Settings ||
  mongoose.model<ISettingsDocument>('Settings', SettingsSchema)
