/**
 * Replace [[placeholder]] tokens in template content with actual values.
 * Any unmatched placeholders are replaced with an empty string.
 */
export function replacePlaceholders(content: string, data: Record<string, string>): string {
  return content.replace(/\[\[(\w+)\]\]/g, (_, key) => data[key] ?? '')
}

/**
 * Canonical placeholder tokens — what the templates editor's Insert Placeholder
 * dropdown surfaces and what `buildPlaceholders` in lib/sendNotification.ts
 * resolves against tenant + unit + settings.
 *
 * Customer:   CUSTOMER_NAME, CUSTOMER_USERNAME, CUSTOMER_EMAIL (aka EMAIL_ADDRESS),
 *             CUSTOMER_PHONE (aka CUSTOMER_PHONE_NUMBER), CUSTOMER_ADDRESS,
 *             CUSTOMER_ACCESS_CODE (aka GATE_CODE)
 * Unit:       UNIT_NUMBER (aka UNIT), UNIT_SIZE, MONTHLY_RATE (aka RENT), DEPOSIT
 * Account:    BALANCE, DUE_DATE, DATE (aka TODAY), PAYMENT_AMOUNT, PAYMENT_DATE
 * Facility:   FACILITY_NAME, FACILITY_PHONE, FACILITY_EMAIL, FACILITY_ADDRESS,
 *             FACILITY_URL, PORTAL_URL
 * Alternate:  ALTERNATE_CONTACT, ALTERNATE_PHONE_NUMBER, ALTERNATE_EMAIL,
 *             ALTERNATE_ADDRESS
 *
 * Legacy [[camelCase]] keys (tenantName, facilityName, …) are also populated by
 * buildPlaceholders so templates seeded before the editor switched to ALL_CAPS
 * keep substituting correctly.
 */
export const AVAILABLE_PLACEHOLDERS = [
  // Canonical
  'CUSTOMER_NAME', 'CUSTOMER_USERNAME', 'CUSTOMER_EMAIL', 'EMAIL_ADDRESS',
  'CUSTOMER_PHONE', 'CUSTOMER_PHONE_NUMBER', 'CUSTOMER_ADDRESS',
  'CUSTOMER_ACCESS_CODE', 'GATE_CODE',
  'UNIT', 'UNIT_NUMBER', 'UNIT_SIZE', 'RENT', 'MONTHLY_RATE', 'DEPOSIT',
  'BALANCE', 'DUE_DATE', 'DATE', 'TODAY', 'PAYMENT_AMOUNT', 'PAYMENT_DATE',
  'FACILITY_NAME', 'FACILITY_PHONE', 'FACILITY_EMAIL', 'FACILITY_ADDRESS',
  'FACILITY_URL', 'PORTAL_URL',
  'ALTERNATE_CONTACT', 'ALTERNATE_PHONE_NUMBER', 'ALTERNATE_EMAIL', 'ALTERNATE_ADDRESS',
  // Legacy aliases
  'tenantName', 'firstName', 'lastName', 'email', 'phone',
  'unitNumber', 'balance', 'facilityName', 'facilityPhone',
  'facilityAddress', 'facilityEmail', 'dueDate', 'monthlyRate',
  'paymentAmount', 'paymentDate', 'gateCode', 'todayDate',
]
