import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      status: 'ok',
      jobs: [
        {
          name: 'generateMonthlyInvoices',
          schedule: '0 0 * * *',
          description: 'Generate monthly rent invoices on each tenant billing day',
        },
        {
          name: 'checkLateFees',
          schedule: '0 6 * * *',
          description: 'Apply late fees after grace period (5 days past due)',
        },
        {
          name: 'checkLockouts',
          schedule: '0 6 * * *',
          description: 'Lock out tenants 10+ days past due',
        },
        {
          name: 'retryFailedPayments',
          schedule: '0 8 * * *',
          description: 'Retry failed autopay payments',
        },
        {
          name: 'sendPaymentReminders',
          schedule: '0 9 * * *',
          description: 'Send payment reminders 3 days before due date',
        },
        {
          name: 'processWaitingList',
          schedule: '0 10 * * 1',
          description: 'Notify waiting list entries when matching units become available',
        },
      ],
    },
  })
}
