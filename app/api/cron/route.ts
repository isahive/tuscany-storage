import { NextRequest, NextResponse } from 'next/server'
import { runAutopay } from '@/jobs/autopay'
import { runDelinquency } from '@/jobs/delinquency'
import { runReminders } from '@/jobs/reminders'
import { runRateManagement } from '@/jobs/rate-management'
import { runRateManagementReminder } from '@/jobs/rate-management-reminder'
import { runRateExecution } from '@/jobs/rate-execution'
import { runInvoiceGeneration } from '@/jobs/invoices'
import { runLockoutReportEmail } from '@/jobs/lockout-report-email'
import { reconcilePdkHolders } from '@/jobs/pdk-reconcile'

const JOBS = {
  generateInvoices: {
    fn: runInvoiceGeneration,
    schedule: '0 0 * * *',
    description: 'Create pending invoices + send Invoice Reminder N days before billing',
  },
  autopay: {
    fn: runAutopay,
    schedule: '0 2 * * *',
    description: 'Charge tenants with autopay 2 days before billing',
  },
  delinquency: {
    fn: runDelinquency,
    schedule: '0 6 * * *',
    description: 'Apply late fees, lockouts, lien escalation, auction scheduling',
  },
  reminders: {
    fn: runReminders,
    schedule: '0 9 * * *',
    description: 'Send payment reminders',
  },
  rateManagement: {
    fn: runRateManagement,
    schedule: '0 4 1 * *',
    description: 'Rate change proposals (monthly)',
  },
  rateExecution: {
    fn: runRateExecution,
    schedule: '0 5 * * *',
    description: 'Apply approved rate changes when effective date arrives',
  },
  rateManagementReminder: {
    fn: runRateManagementReminder,
    schedule: '0 8 * * *',
    description: 'Daily check — sends the monthly Rate Management reminder email on the configured day',
  },
  lockoutReportEmail: {
    fn: runLockoutReportEmail,
    schedule: '0 7 * * *',
    description: 'Daily Lock Out Report digest emailed to the notifications email',
  },
  pdkReconcile: {
    fn: reconcilePdkHolders,
    schedule: '0 3 * * *',
    description: 'Reconcile Tuscany tenants with PDK holders + facility-hour rules',
  },
} as const

type JobName = keyof typeof JOBS

// GET — list registered cron jobs (no auth required).
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      status: 'ok',
      jobs: Object.entries(JOBS).map(([name, meta]) => ({
        name,
        schedule: meta.schedule,
        description: meta.description,
      })),
    },
  })
}

// POST — execute a job by name. Requires Authorization: Bearer <CRON_SECRET>.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => ({}))
  const name = body?.job as JobName | undefined
  if (!name || !(name in JOBS)) {
    return NextResponse.json(
      { success: false, error: `Unknown job. Valid: ${Object.keys(JOBS).join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const result = await JOBS[name].fn()
    return NextResponse.json({ success: true, data: { job: name, result } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Job failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
