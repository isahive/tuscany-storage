/**
 * Render cron entry point. Hits the in-app endpoint /api/cron/recurring-billing
 * with the shared CRON_SECRET so it executes the sweep using the same DB & Stripe
 * setup the web service uses.
 *
 * Required env vars (set in Render):
 *   APP_URL       e.g. https://tuscany-storage.onrender.com
 *   CRON_SECRET   shared with the web service
 */
const APP_URL = process.env.APP_URL || 'http://localhost:3001'
const CRON_SECRET = process.env.CRON_SECRET
const DRY = process.argv.includes('--dry')

const endpoint = `${APP_URL.replace(/\/$/, '')}/api/cron/recurring-billing`

;(async () => {
  console.log(`[${new Date().toISOString()}] POST ${endpoint}`)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
      },
      body: JSON.stringify({ dryRun: DRY }),
    })
    const text = await res.text()
    console.log(`HTTP ${res.status}`)
    console.log(text)
    if (!res.ok) process.exit(1)
  } catch (err) {
    console.error('Cron call failed:', err)
    process.exit(1)
  }
})()
