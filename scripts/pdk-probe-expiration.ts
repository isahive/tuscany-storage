/**
 * One-shot probe: does PDK Holder support activation/expiration timestamps?
 *
 * Strategy:
 *   1) List existing holders + inspect one to see what fields PDK actually
 *      returns (reveals supported schema beyond what we use today).
 *   2) Try creating a throwaway holder with several common timestamp field
 *      names; whichever round-trips on GET is the right one.
 *   3) Clean up: delete the probe holder before exiting.
 *
 * Safe to run multiple times. Only touches a "PROBE-" prefixed holder.
 *
 *   npx tsx --env-file=.env.local scripts/pdk-probe-expiration.ts
 */
import { pdkFetch } from '@/lib/pdkAuth'

const PROBE_PREFIX = 'PROBE-DELETE-ME-'

async function listFields(): Promise<void> {
  console.log('\n[1] listing existing holders to see schema fields…')
  const res = await pdkFetch('/holders')
  if (!res.ok) {
    console.error(`  list failed: ${res.status}`)
    return
  }
  const list = (await res.json()) as any[]
  console.log(`  found ${list.length} holders`)
  if (list.length === 0) return
  const sample = list[0]
  console.log('  sample holder keys:', Object.keys(sample).sort().join(', '))
  console.log('  sample holder full:', JSON.stringify(sample, null, 2))
}

async function tryCreate(extra: Record<string, unknown>, label: string): Promise<string | null> {
  const firstName = `${PROBE_PREFIX}${label}`
  const body = {
    firstName,
    lastName: 'Probe',
    enabled: true,
    ...extra,
  }
  console.log(`\n[2] POST /holders with ${label}:`, JSON.stringify(extra))
  const res = await pdkFetch('/holders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.log(`  → ${res.status} ${text}`)
    return null
  }
  const holder = (await res.json()) as { id: string }
  console.log(`  → created id=${holder.id}`)

  // Re-fetch to see what PDK persisted.
  const back = await pdkFetch(`/holders/${holder.id}`)
  if (back.ok) {
    const refreshed = await back.json()
    console.log('  GET back:', JSON.stringify(refreshed, null, 2))
  }
  return holder.id
}

async function cleanup(holderId: string): Promise<void> {
  const res = await pdkFetch(`/holders/${holderId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    console.warn(`  cleanup failed for ${holderId}: ${res.status}`)
  } else {
    console.log(`  ✓ deleted ${holderId}`)
  }
}

async function main() {
  await listFields()

  const created: string[] = []

  // PDK SDK reference suggests `activation` + `expiration` (ISO 8601). Try
  // several common spellings in order; first one that survives the round-trip
  // wins.
  const now = new Date()
  const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000)

  const candidates: Array<[string, Record<string, unknown>]> = [
    ['activation+expiration', {
      activation: now.toISOString(),
      expiration: in3h.toISOString(),
    }],
    ['startDate+endDate', {
      startDate: now.toISOString(),
      endDate: in3h.toISOString(),
    }],
    ['validFrom+validUntil', {
      validFrom: now.toISOString(),
      validUntil: in3h.toISOString(),
    }],
    ['expires', {
      expires: in3h.toISOString(),
    }],
  ]

  for (const [label, body] of candidates) {
    const id = await tryCreate(body, label)
    if (id) created.push(id)
  }

  console.log('\n[3] cleanup…')
  for (const id of created) await cleanup(id)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
