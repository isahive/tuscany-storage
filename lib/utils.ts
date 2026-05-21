export const formatMoney = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

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
