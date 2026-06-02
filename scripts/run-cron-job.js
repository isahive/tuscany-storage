/**
 * Generic Render cron entry point — POSTs the configured job to the
 * web service's /api/cron endpoint with the shared CRON_SECRET.
 *
 * Usage:  node scripts/run-cron-job.js <jobName>
 *
 * The job name must match a key in JOBS map at app/api/cron/route.ts.
 * Valid names today: generateInvoices, autopay, delinquency, reminders,
 * rateManagement, rateExecution, rateManagementReminder, lockoutReportEmail,
 * pdkReconcile.
 *
 * Required env vars (set in the Render cron service):
 *   APP_URL       e.g. https://tuscany-storage.onrender.com
 *   CRON_SECRET   shared with the web service
 */
const JOB = process.argv[2]
if (!JOB) {
  console.error('Usage: node scripts/run-cron-job.js <jobName>')
  process.exit(2)
}

const APP_URL = process.env.APP_URL || 'http://localhost:3001'
const CRON_SECRET = process.env.CRON_SECRET

const endpoint = `${APP_URL.replace(/\/$/, '')}/api/cron`

;(async () => {
  console.log(`[${new Date().toISOString()}] POST ${endpoint} (job=${JOB})`)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
      },
      body: JSON.stringify({ job: JOB }),
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
