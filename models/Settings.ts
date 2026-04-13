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

  // ── Fees (cents) ─────────────────────────────────────────────────────────
  lateFeeAfterDays: number
  lateFeeAmount: number
  nsfFeeAmount: number
  auctionFeeAmount: number

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

  // ── Custom fees ──────────────────────────────────────────────────────────
  customFees: Array<{
    id: string
    name: string
    amount: number // cents
    description: string
    active: boolean
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

    // Fees
    lateFeeAfterDays: { type: Number, default: 5 },
    lateFeeAmount:    { type: Number, default: 2000 },
    nsfFeeAmount:     { type: Number, default: 3500 },
    auctionFeeAmount: { type: Number, default: 5000 },

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

    // Custom fees
    customFees: {
      type: [{
        id:          { type: String, required: true },
        name:        { type: String, required: true },
        amount:      { type: Number, required: true },
        description: { type: String, default: '' },
        active:      { type: Boolean, default: true },
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
      }],
      default: [],
    },
  },
  { timestamps: true },
)

export default mongoose.models.Settings ||
  mongoose.model<ISettingsDocument>('Settings', SettingsSchema)
