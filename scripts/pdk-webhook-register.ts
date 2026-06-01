/**
 * Register a webhook subscription against the configured PDK organization.
 *
 * Idempotent — if a subscription already exists with the same URL we delete
 * it first and re-register, so editing event list / secret is one command.
 *
 * Requires env: PDK_ORG_ID, PDK_WEBHOOK_URL, PDK_WEBHOOK_SECRET
 *
 * In dev, expose the local Next.js server with a tunnel (ngrok, cloudflared)
 * and set PDK_WEBHOOK_URL to the public HTTPS URL, e.g.:
 *   ngrok http 3000
 *   → PDK_WEBHOOK_URL=https://abc123.ngrok.io/api/webhooks/pdk
 *
 * Usage:  npx tsx --env-file=.env.local scripts/pdk-webhook-register.ts
 */
import { getIdToken } from '@/lib/pdkAuth'

const SUBSCRIPTION_NAME = 'Tuscany Storage gate events'

// What we listen for. Keep aligned with the switch in app/api/webhooks/pdk.
const EVENTS = [
  'device.request.allowed',
  'device.request.denied',
  'device.request.unknown',
  'device.alarm.forced',
  'device.alarm.forced.cleared',
  'device.alarm.propped.on',
  'device.alarm.propped.off',
]

async function main() {
  for (const v of ['PDK_ORG_ID', 'PDK_WEBHOOK_URL', 'PDK_WEBHOOK_SECRET']) {
    if (!process.env[v]) {
      console.error(`${v} is required.`)
      process.exit(1)
    }
  }
  const orgId = process.env.PDK_ORG_ID!
  const url = process.env.PDK_WEBHOOK_URL!
  const secret = process.env.PDK_WEBHOOK_SECRET!

  if (!url.startsWith('https://')) {
    console.error('PDK_WEBHOOK_URL must be HTTPS (use a tunnel like ngrok in dev).')
    process.exit(1)
  }

  const token = await getIdToken()
  const base = `https://accounts.pdk.io/api/organizations/${orgId}/subscriptions`

  // Look for an existing subscription with the same URL and delete it so the
  // new event list / secret takes effect.
  const listRes = await fetch(base, { headers: { Authorization: `Bearer ${token}` } })
  if (!listRes.ok) {
    const body = await listRes.text().catch(() => '')
    console.error(`List failed: ${listRes.status} ${body}`)
    process.exit(1)
  }
  const existing = (await listRes.json()) as Array<{ id: string; url: string }>
  const dup = existing.find((s) => s.url === url)
  if (dup) {
    console.log(`Removing existing subscription ${dup.id} for ${url}…`)
    const del = await fetch(`${base}/${dup.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!del.ok) {
      const body = await del.text().catch(() => '')
      console.error(`Delete failed: ${del.status} ${body}`)
      process.exit(1)
    }
  }

  console.log(`Registering ${url}…`)
  const createRes = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: SUBSCRIPTION_NAME,
      url,
      scope: 'this',
      authentication: { type: 'None' },
      events: EVENTS,
      active: true,
      sslVerification: true,
      // 0 = include everything (we want holderId + pin events for AccessLog).
      secrecyLevel: 0,
      secret,
    }),
  })

  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '')
    console.error(`Create failed: ${createRes.status} ${body}`)
    process.exit(1)
  }

  const created = (await createRes.json()) as { id: string; name: string; url: string }
  console.log('✓ registered')
  console.log(`  id:   ${created.id}`)
  console.log(`  name: ${created.name}`)
  console.log(`  url:  ${created.url}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
