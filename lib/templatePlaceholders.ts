/**
 * Replace [[placeholder]] tokens in template content with actual values.
 * Any unmatched placeholders are replaced with an empty string.
 */
export function replacePlaceholders(content: string, data: Record<string, string>): string {
  return content.replace(/\[\[(\w+)\]\]/g, (_, key) => data[key] ?? '')
}

/**
 * Common placeholders available for all templates:
 * [[tenantName]] - Full name of tenant
 * [[firstName]] - Tenant first name
 * [[lastName]] - Tenant last name
 * [[email]] - Tenant email
 * [[phone]] - Tenant phone
 * [[unitNumber]] - Unit number
 * [[balance]] - Current balance due
 * [[facilityName]] - Facility name
 * [[facilityPhone]] - Facility phone
 * [[facilityAddress]] - Facility address
 * [[facilityEmail]] - Facility email
 * [[dueDate]] - Next due date
 * [[monthlyRate]] - Monthly rental rate
 * [[paymentAmount]] - Payment amount
 * [[paymentDate]] - Payment date
 * [[gateCode]] - Gate access code
 * [[todayDate]] - Today's date
 */
export const AVAILABLE_PLACEHOLDERS = [
  'tenantName', 'firstName', 'lastName', 'email', 'phone',
  'unitNumber', 'balance', 'facilityName', 'facilityPhone',
  'facilityAddress', 'facilityEmail', 'dueDate', 'monthlyRate',
  'paymentAmount', 'paymentDate', 'gateCode', 'todayDate',
]
