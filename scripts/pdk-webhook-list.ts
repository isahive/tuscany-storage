/**
 * List PDK webhook subscriptions for the configured organization.
 *
 * Usage:  npx tsx --env-file=.env.local scripts/pdk-webhook-list.ts
 */
import { getIdToken } from '@/lib/pdkAuth'

async function main() {
  const orgId = process.env.PDK_ORG_ID
  if (!orgId) {
    console.error('PDK_ORG_ID is required.')
    process.exit(1)
  }

  const token = await getIdToken()
  const res = await fetch(
    `https://accounts.pdk.io/api/organizations/${orgId}/subscriptions`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`Failed: ${res.status} ${body}`)
    process.exit(1)
  }

  const subs = (await res.json()) as Array<{
    id: string
    name: string
    url: string
    active: boolean
    events: string[]
    scope: unknown
  }>

  if (subs.length === 0) {
    console.log('No subscriptions registered.')
    return
  }

  for (const s of subs) {
    console.log(`${s.id}`)
    console.log(`  name:   ${s.name}`)
    console.log(`  url:    ${s.url}`)
    console.log(`  active: ${s.active}`)
    console.log(`  events: ${s.events.join(', ')}`)
    console.log()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
