/**
 * Pure functions for detecting potentially-duplicate tenants.
 *
 * The operator uses this on the `/admin/tenants/duplicates` panel to find
 * people who created two accounts (same card, same name, same address, …)
 * and link them so contact attempts pre-auction reach every channel.
 *
 * Everything here is intentionally side-effect-free so the unit tests can
 * cover the matching rules without touching MongoDB.
 */

export type MatchReason = 'card' | 'name' | 'address' | 'phone' | 'email'

export type MatchConfidence = 'high' | 'medium' | 'low'

/** Minimal tenant projection the matcher needs. Real callers pass plain JS
 *  objects projected from Mongo — never Mongoose documents. */
export interface TenantForMatch {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  zip?: string | null
  billingAddress?: {
    line1?: string | null
    zip?: string | null
  } | null
  cardFingerprint?: string | null
  linkedTenantIds?: string[]
  dismissedMatchIds?: string[]
  archived?: boolean
  isRetailWalkIn?: boolean
}

export interface DuplicateMatch {
  tenantId: string
  otherId: string
  reasons: MatchReason[]
  confidence: MatchConfidence
}

/** Strip accents, lowercase, collapse whitespace, drop punctuation. */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Just the digits — used for phone matching. */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return ''
  const digits = input.replace(/\D/g, '')
  // Tolerate leading US country code.
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

/** Email match key — local + domain, both lowercased. Strips "+suffix". */
export function normalizeEmail(input: string | null | undefined): string {
  if (!input) return ''
  const trimmed = input.trim().toLowerCase()
  const [local, domain] = trimmed.split('@')
  if (!local || !domain) return ''
  const cleanLocal = local.split('+')[0]
  return `${cleanLocal}@${domain}`
}

/** Combined name key: "first last" normalized. Returns '' if either part missing. */
export function nameKey(t: TenantForMatch): string {
  const first = normalizeText(t.firstName)
  const last = normalizeText(t.lastName)
  if (!first || !last) return ''
  return `${first} ${last}`
}

/** Address key: line1 + zip, both normalized. Returns '' if line1 OR zip missing. */
export function addressKey(t: TenantForMatch): string {
  const line1 = normalizeText(t.address || t.billingAddress?.line1 || '')
  const zip = (t.zip || t.billingAddress?.zip || '').trim()
  if (!line1 || !zip) return ''
  return `${line1}|${zip}`
}

function confidenceFor(reasons: MatchReason[]): MatchConfidence {
  if (reasons.includes('card')) return 'high'
  if (reasons.length >= 2) return 'high'
  if (reasons.includes('name') || reasons.includes('address')) return 'medium'
  return 'low'
}

/** A pair-id that is stable regardless of which tenant is "a" or "b". */
export function pairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join('::')
}

function isExcluded(t: TenantForMatch): boolean {
  return Boolean(t.archived || t.isRetailWalkIn)
}

function alreadyLinkedOrDismissed(a: TenantForMatch, b: TenantForMatch): boolean {
  const linked = (a.linkedTenantIds || []).includes(b.id)
  const dismissed = (a.dismissedMatchIds || []).includes(b.id)
  return linked || dismissed
}

/**
 * Run the duplicate scan against an in-memory tenant list.
 *
 * Returns one entry per (tenantId, otherId) ordered pair — so a UI that shows
 * "this tenant has N possible duplicates" can `.filter(m => m.tenantId === x)`.
 *
 * Excluded by design: archived tenants, the retail walk-in synthetic tenant,
 * already-linked pairs, and pairs the operator dismissed.
 */
export function findDuplicates(tenants: TenantForMatch[]): DuplicateMatch[] {
  const active = tenants.filter((t) => !isExcluded(t))

  // Build inverted indexes so the inner loop is O(matches) instead of O(n^2).
  const byCard = new Map<string, string[]>()
  const byName = new Map<string, string[]>()
  const byAddress = new Map<string, string[]>()
  const byPhone = new Map<string, string[]>()
  const byEmail = new Map<string, string[]>()

  for (const t of active) {
    if (t.cardFingerprint) push(byCard, t.cardFingerprint, t.id)
    const nk = nameKey(t)
    if (nk) push(byName, nk, t.id)
    const ak = addressKey(t)
    if (ak) push(byAddress, ak, t.id)
    const pk = normalizePhone(t.phone)
    if (pk) push(byPhone, pk, t.id)
    const ek = normalizeEmail(t.email)
    if (ek) push(byEmail, ek, t.id)
  }

  // Aggregate reasons per pair.
  const reasonsByPair = new Map<string, Set<MatchReason>>()
  collectReasons(byCard, 'card', reasonsByPair)
  collectReasons(byName, 'name', reasonsByPair)
  collectReasons(byAddress, 'address', reasonsByPair)
  collectReasons(byPhone, 'phone', reasonsByPair)
  collectReasons(byEmail, 'email', reasonsByPair)

  const byId = new Map(active.map((t) => [t.id, t]))
  const results: DuplicateMatch[] = []
  for (const [pair, reasonSet] of reasonsByPair) {
    const [idA, idB] = pair.split('::')
    const a = byId.get(idA)
    const b = byId.get(idB)
    if (!a || !b) continue
    if (alreadyLinkedOrDismissed(a, b)) continue
    const reasons = Array.from(reasonSet).sort()
    const confidence = confidenceFor(reasons)
    results.push({ tenantId: idA, otherId: idB, reasons, confidence })
    results.push({ tenantId: idB, otherId: idA, reasons, confidence })
  }
  return results.sort((a, b) => rank(b.confidence) - rank(a.confidence))
}

function push(map: Map<string, string[]>, key: string, id: string) {
  const list = map.get(key)
  if (list) list.push(id)
  else map.set(key, [id])
}

function collectReasons(
  index: Map<string, string[]>,
  reason: MatchReason,
  reasonsByPair: Map<string, Set<MatchReason>>,
) {
  for (const ids of index.values()) {
    if (ids.length < 2) continue
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = pairKey(ids[i], ids[j])
        const set = reasonsByPair.get(key) || new Set<MatchReason>()
        set.add(reason)
        reasonsByPair.set(key, set)
      }
    }
  }
}

function rank(c: MatchConfidence): number {
  return c === 'high' ? 3 : c === 'medium' ? 2 : 1
}
