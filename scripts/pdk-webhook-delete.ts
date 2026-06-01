/**
 * Delete a PDK webhook subscription by id.
 *
 * Usage:  npx tsx --env-file=.env.local scripts/pdk-webhook-delete.ts <subscription_id>
 */
import { getIdToken } from '@/lib/pdkAuth'

async function main() {
  const subId = process.argv[2]
  const orgId = process.env.PDK_ORG_ID
  if (!subId) {
    console.error('Usage: pdk-webhook-delete <subscription_id>')
    process.exit(1)
  }
  if (!orgId) {
    console.error('PDK_ORG_ID is required.')
    process.exit(1)
  }

  const token = await getIdToken()
  const res = await fetch(
    `https://accounts.pdk.io/api/organizations/${orgId}/subscriptions/${subId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`Failed: ${res.status} ${body}`)
    process.exit(1)
  }

  console.log(`✓ deleted ${subId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
