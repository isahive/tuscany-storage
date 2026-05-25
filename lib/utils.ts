export const formatMoney = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

export type CustomerNameFormat = 'last_first' | 'first_last'

/**
 * Common multi-word surname prefixes. When the token preceding the final
 * lastName token matches one of these, we treat them as a single compound
 * surname (e.g. "Van Buren", "De La Cruz", "St. John") instead of splitting
 * the leading word out as a middle name.
 */
const SURNAME_PREFIXES = new Set([
  'van', 'von', 'der', 'den',
  'de', 'del', 'della', 'di', 'da', 'das', 'do', 'dos',
  'la', 'le', 'el', 'al',
  'mc', 'mac', "o'", 'st', 'st.', 'saint',
  'ben', 'ibn', 'bin', 'abu',
])

/**
 * Splits firstName/lastName into {first, middle, last} parts, accounting for
 * the common dirty-data case where a middle name was lumped into `lastName`.
 *
 * Examples (firstName / lastName → first / middle / last):
 *   "John" / "Robert Smith"      → "John" / "Robert" / "Smith"
 *   "John" / "Van Buren"         → "John" / ""       / "Van Buren"
 *   "John" / "De La Cruz"        → "John" / ""       / "De La Cruz"
 *   "John Robert" / "Smith"      → "John Robert" / "" / "Smith"
 *   "John" / "Smith"             → "John" / "" / "Smith"
 */
export function splitNameParts(parts: { firstName?: string | null; lastName?: string | null }): {
  first: string
  middle: string
  last: string
} {
  const first = (parts.firstName ?? '').trim()
  const rawLast = (parts.lastName ?? '').trim()
  const tokens = rawLast.split(/\s+/).filter(Boolean)
  if (tokens.length <= 1) return { first, middle: '', last: rawLast }

  // Walk backwards from the final token, absorbing surname-prefix words
  // (Van, De, La, etc.) into the surname so they don't get treated as middle.
  let surnameStart = tokens.length - 1
  while (
    surnameStart > 0 &&
    SURNAME_PREFIXES.has(tokens[surnameStart - 1].toLowerCase())
  ) {
    surnameStart--
  }
  const last = tokens.slice(surnameStart).join(' ')
  const middle = tokens.slice(0, surnameStart).join(' ')
  return { first, middle, last }
}

export function formatCustomerName(
  parts: { firstName?: string | null; lastName?: string | null },
  format: CustomerNameFormat = 'last_first',
): string {
  const { first, middle, last } = splitNameParts(parts)
  if (!first && !last && !middle) return ''
  if (!last) return [first, middle].filter(Boolean).join(' ')
  if (!first && !middle) return last
  if (format === 'last_first') {
    const given = [first, middle].filter(Boolean).join(' ')
    return given ? `${last}, ${given}` : last
  }
  return [first, middle, last].filter(Boolean).join(' ')
}

/** Lowercase sort key derived from the real surname. */
export function customerSortKey(parts: { firstName?: string | null; lastName?: string | null }): string {
  return splitNameParts(parts).last.toLowerCase()
}

export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

export function calculateProratedAmount(monthlyRate: number, startDate: Date): number {
  const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate()
  const remainingDays = daysInMonth - startDate.getDate() + 1
  return Math.ceil((monthlyRate / daysInMonth) * remainingDays)
}

export function generateGateCode(): string {
  // Use crypto for secure random gate code generation
  const crypto = require('crypto')
  return crypto.randomInt(1000, 10000).toString()
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  opts: { maxLimit?: number } = {},
): { page: number; limit: number; skip: number } {
  const maxLimit = opts.maxLimit ?? 100
  // `|| 1` / `|| 20` defaults guard against `parseInt('abc') → NaN`, which
  // would otherwise propagate through Math.max and yield NaN bounds.
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}
