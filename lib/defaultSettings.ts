export const DEFAULT_SETTINGS = {
  // Facility
  facilityName: 'Tuscany Village Self Storage',
  facilityAddress: '2519 Highway 116',
  facilityCity: 'Caryville',
  facilityState: 'TN',
  facilityZip: '37714',
  facilityPhone: '(865) 426-2100',
  facilityEmail: 'Tuscanystorage@gmail.com',
  accessHoursStart: '05:00',
  accessHoursEnd: '22:00',
  // PDK gate-access wiring — populated via /admin/settings/gate after the
  // integrator selects which devices are entry vs exit.
  pdkTenantGroupId: '',
  pdkEntryDeviceIds: [] as string[],
  pdkExitDeviceIds: [] as string[],
  // Locale
  locale: 'en-US',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  timeZone: 'America/New_York',
  phoneFormat: '(555) 555-5555',
  dimensionFormat: '10w x 10l x 10h',
  customerNameFormat: 'last_first' as const,
  // Tax
  taxEnabled: true,
  taxRate: 9.75,
  // Billing
  billingDaysBeforeDue: 7,
  // Billing Cycle
  billingCycleAnchor: 'first_of_month' as const,
  billingCycleCustomDay: 1,
  // Proration
  prorationModel: 'first_month_full_then_prorate' as const,
  prorationDaysBasis: 'actual_days_in_month' as const,
  // Deprecated — kept only so the cron/lien-escalation code that hasn't been
  // refactored yet can still read default amounts. The source of truth for
  // every fee (including system fees) is `customFees` below.
  lateFeeAfterDays: 5,
  lateFeeAmount: 2000,
  nsfFeeAmount: 3500,
  auctionFeeAmount: 5000,
  auctionGracePeriodDays: 14,
  auctionDaysAfterLockout: 30,
  auctionFixedDate: null as Date | null,
  // Reservation fees — empty by default; admin opts in per unit type.
  unitTypeReservationFees: [] as Array<{ unitType: string; amount: number }>,
  // Rate Management — disabled by default; admin opts in.
  rateManagementEnabled: false,
  rateManagementReminderDay: 1,
  rentalPriceAdvanceNoticeDays: 30,
  rentalPriceAllowExceedingStreetRate: false,
  rentalPriceRoundToNearestDollar: true,
  unitTypePriceRules: [] as Array<{ id: string; unitType: string; increaseAmount?: number; increasePercent?: number; minOccupancyPct: number; roundingRule: 'none' | 'nearest_dollar' }>,
  rentalPriceRules: [] as Array<{ id: string; unitType: string; increaseAmount?: number; increasePercent?: number; minMonthsSinceLastChange: number }>,
  setupFeeAmount: 0,
  setupFeeName: 'Setup Fee',
  setupFeeDescription: '',
  // Email branding — the wrapper falls back to /images/brand/logo.png when blank.
  // The signature/footer lives in each template's body, not here.
  emailLogoUrl: '',
  // Reservations
  enableReservations: false,
  reservationLimitDays: 0,
  // Customer permissions
  customersCanEditProfile: true,
  customersCanEditBilling: true,
  customersCanScheduleMoveOuts: true,
  // New renter instructions
  newRenterInstructions:
    'Gate LOCKS at 10:00 p.m. and will not open in or out. If you find yourself locked in the facility after 10PM, call (865) 426-2100 to be let out remotely.',
  // Lockout
  lockoutRequireApprovalAuto: false,
  lockoutRequireApprovalManual: false,
  // Custom fees
  // Source of truth for ALL fees the system knows about — built-in and admin-defined.
  // `code` (optional) tags a row as a system-managed fee so the cron / lien-escalation
  // logic can find it by intent ('late', 'nsf', 'auction'). When `code` is absent the
  // fee is purely user-defined.
  customFees: [
    { id: 'fee_late',    code: 'late',    name: 'Past Due Fee',           amount: 2000, description: '', active: true },
    { id: 'fee_nsf',     code: 'nsf',     name: 'NSF / Returned Check',   amount: 3500, description: 'Non-sufficient funds or returned check', active: true },
    { id: 'fee_auction', code: 'auction', name: 'Auction / Sale Fee',     amount: 5000, description: 'Lien sale processing fee', active: true },
  ] as Array<{ id: string; code?: string; name: string; amount: number; description: string; active: boolean }>,
  // Late / Lien escalation
  lateLienEvents: [
    { id: 'evt_late_1',    status: 'late'       as const, daysPastDue: 1,  notifyEmail: false, notifyText: false, notifyLetter: false, notificationTemplate: '',                                                                                          fees: [],                                                              actions: [] },
    { id: 'evt_late_4',    status: 'late'       as const, daysPastDue: 4,  notifyEmail: true,  notifyText: true,  notifyLetter: false, notificationTemplate: 'Past Due Warning',                                                                            fees: [],                                                              actions: [] },
    { id: 'evt_late_5',    status: 'late'       as const, daysPastDue: 5,  notifyEmail: true,  notifyText: true,  notifyLetter: false, notificationTemplate: 'Past Due Notice',                                                                              fees: [{ name: 'Past Due Fee', amount: 2000 }],                        actions: [] },
    { id: 'evt_lockout_9', status: 'locked_out' as const, daysPastDue: 9,  notifyEmail: true,  notifyText: true,  notifyLetter: false, notificationTemplate: 'Past Due Notice',                                                                              fees: [],                                                              actions: ['lockout'] },
    { id: 'evt_prelien_15',status: 'pre_lien'   as const, daysPastDue: 15, notifyEmail: true,  notifyText: true,  notifyLetter: false, notificationTemplate: 'Notice of Lockout of Storage Unit / Notice of Intended Sale of Personal Property At Auction',  fees: [],                                                              actions: [] },
    { id: 'evt_lien_30',   status: 'lien'       as const, daysPastDue: 30, notifyEmail: true,  notifyText: true,  notifyLetter: false, notificationTemplate: 'Notice of Lockout of Storage Unit / Notice of Intended Sale of Personal Property At Auction',  fees: [],                                                              actions: [] },
    { id: 'evt_auction_37',status: 'auction'    as const, daysPastDue: 37, notifyEmail: true,  notifyText: true,  notifyLetter: true,  notificationTemplate: 'Notice of Foreclosure of Lien and Sale of Personal Property',                                  fees: [{ name: 'Advertisement Fee', amount: 2500 }, { name: 'Cut Lock Fee', amount: 2000 }], actions: ['queue_print'] },
  ],
  // Gate
  gateAutoAssign: true,
  gateAutoAssignMethod: 'phone_last4' as const,
  gateCodeLength: 4,
  gateAutoLockout: true,
  gateTextToOpen: false,
  gateTextToOpenNumber: '',
  gateControllerType: '',
  gateNodeId: '',
  gateApiEndpoint: '',
  gateApiKey: '',
  // Agreement
  agreementTitle: 'Storage Lease Agreement',
  agreementTemplate: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Storage Rental Agreement' }] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Tuscany Village Self Storage · [[FACILITY_NAME]]' }] },
      { type: 'horizontalRule' },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Parties' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'This Storage Rental Agreement ("Agreement") is entered into as of [[DATE]] between Tuscany Village Self Storage ("Operator") and the following tenant:' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Name: ', marks: [{ type: 'bold' }] }, { type: 'text', text: '[[CUSTOMER_NAME]]' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Address: ', marks: [{ type: 'bold' }] }, { type: 'text', text: '[[CUSTOMER_ADDRESS]]' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Phone: ', marks: [{ type: 'bold' }] }, { type: 'text', text: '[[CUSTOMER_PHONE_NUMBER]]' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Email: ', marks: [{ type: 'bold' }] }, { type: 'text', text: '[[EMAIL_ADDRESS]]' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Storage Unit' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Unit Number: ', marks: [{ type: 'bold' }] }, { type: 'text', text: '[[UNIT]]' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Unit Size: ', marks: [{ type: 'bold' }] }, { type: 'text', text: '[[UNIT_SIZE]]' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Gate Access Code: ', marks: [{ type: 'bold' }] }, { type: 'text', text: '[[CUSTOMER_ACCESS_CODE]]' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Rent & Deposit' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Monthly Rent: ', marks: [{ type: 'bold' }] }, { type: 'text', text: '[[RENT]] due on the same day each month.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Security Deposit: ', marks: [{ type: 'bold' }] }, { type: 'text', text: '[[DEPOSIT]] (refundable upon satisfactory move-out).' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '4. Term' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'This Agreement begins on [[DATE]] and continues on a month-to-month basis until terminated by either party with at least 10 days written notice.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '5. Use of Unit' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Tenant agrees to use the storage unit solely for the storage of personal or business property and not for any illegal purpose. Tenant shall not store flammable, explosive, hazardous materials, living beings, food, or perishable items.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '6. Access' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The facility is accessible during posted access hours. After-hours access is not permitted. The gate access code is personal and must not be shared.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '7. Late Fees' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Rent not received within 5 days of the due date is subject to a late fee. Continued non-payment may result in lien sale proceedings in accordance with applicable state law.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '8. Limitation of Liability' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Operator is not responsible for loss, theft, or damage to stored property. Tenant is encouraged to maintain renter\'s insurance for the full value of stored items.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '9. Termination' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Either party may terminate this Agreement with 10 days written notice. Upon termination, Tenant must remove all property and return the unit in clean condition.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '10. Agreement' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'By signing below, Tenant acknowledges having read, understood, and agreed to all terms of this Storage Rental Agreement.' }] },
      { type: 'horizontalRule' },
      { type: 'paragraph', content: [{ type: 'text', text: 'Date: [[DATE]]' }] },
    ],
  },
  // Customer form fields
  customerFormFields: [
    { key: 'name',              label: 'Name',                                             fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: true,  showOnWaitingList: true,  requiredOnWaitingList: true,  isCustom: false, order: 0 },
    { key: 'address',           label: 'Address',                                          fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 1 },
    { key: 'city',              label: 'City',                                             fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 2 },
    { key: 'state',             label: 'State/Province',                                   fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 3 },
    { key: 'zip',               label: 'Zip/Postal Code',                                  fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 4 },
    { key: 'phone',             label: 'Phone',                                            fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 5 },
    { key: 'cellPhone',         label: 'Cell Phone',                                       fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: false, showOnWaitingList: true,  requiredOnWaitingList: true,  isCustom: false, order: 6 },
    { key: 'driversLicense',    label: 'Drivers license number',                           fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: true,  showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 7 },
    { key: 'driversLicenseState', label: 'Drivers license state',                          fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: true,  showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 8 },
    { key: 'ssn',               label: 'Social security number',                           fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 9 },
    { key: 'employerName',      label: 'Employer name',                                    fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 10 },
    { key: 'employerPhone',     label: 'Employer phone',                                   fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 11 },
    { key: 'emergencyContact',  label: 'Emergency contact',                                fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 12 },
    { key: 'emergencyPhone',    label: 'Emergency phone',                                  fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 13 },
    { key: 'idPhoto',           label: 'Photo ID (Driver\'s License or Government Issued ID)', fieldType: 'text' as const, options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: true,  showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 14 },
    { key: 'alternateContact',  label: 'Alternate Contact',                                fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: true,  showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 15 },
    { key: 'alternateAddress',  label: 'Alternate Address',                                fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 16 },
    { key: 'alternateCity',     label: 'Alternate City',                                   fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 17 },
    { key: 'alternateState',    label: 'Alternate State/Province',                         fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 18 },
    { key: 'alternateZip',      label: 'Alternate Zip/Postal Code',                        fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 19 },
    { key: 'alternatePhone',    label: 'Alternate Phone Number',                           fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: true,  showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 20 },
    { key: 'alternateEmail',    label: 'Alternate Email',                                  fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 21 },
    { key: 'referralSource',    label: 'Referred by',                                      fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 22 },
    { key: 'securityQuestion',  label: 'Security question',                                fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 23 },
    { key: 'securityAnswer',    label: 'Security answer',                                  fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: false, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 24 },
    { key: 'driversLicenseNumber', label: "Driver's License Number",                       fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: true,  showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 25 },
    { key: 'alternateContactName', label: 'Alternate Contact Name',                        fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 30 },
    { key: 'howDidYouHear',     label: 'How did you hear about us?',                       fieldType: 'select' as const,   options: ['Referral', 'Google Search', 'Drove By', 'Yelp', 'Facebook', 'Other'], helpText: '', showOnSignup: true,  requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 80 },
    { key: 'howDidYouHearOther', label: 'Tell us more (optional)',                         fieldType: 'text' as const,     options: [] as string[], helpText: '', showOnSignup: true,  requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 81 },
    { key: 'smsConsent',        label: 'I agree to receive text message communications from this facility', fieldType: 'checkbox' as const, options: [] as string[], helpText: 'By subscribing, you agree to receive communications via text message at the phone number provided. Reply STOP to cancel. Message rates may apply.', showOnSignup: true, requiredOnSignup: false, showOnWaitingList: false, requiredOnWaitingList: false, isCustom: false, order: 100 },
  ],
}
