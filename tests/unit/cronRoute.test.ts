import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { makeRequest } from '@/tests/helpers/request'

// Stub every job — we're testing the dispatcher, not the work each job does.
// vi.hoisted lets us reference the spy in the (also hoisted) vi.mock factory.
const jobMocks = vi.hoisted(() => ({
  runInvoiceGeneration:        vi.fn(async () => 'invoices-result'),
  runAutopay:                  vi.fn(async () => undefined),
  runDelinquency:              vi.fn(async () => 'delinquency-result'),
  runReminders:                vi.fn(async () => undefined),
  runRateManagement:           vi.fn(async () => ({ rentalSuggestions: [], unitTypeSuggestions: [], proposals: [] })),
  runRateExecution:            vi.fn(async () => []),
  runRateManagementReminder:   vi.fn(async () => ({ sent: false })),
  runLockoutReportEmail:       vi.fn(async () => ({ sent: false, count: 0 })),
  reconcilePdkHolders:         vi.fn(async () => ({ scanned: 0, provisioned: 0, patched: 0, inSync: 0, failed: 0, errors: [] })),
}))
vi.mock('@/jobs/invoices', () => ({ runInvoiceGeneration: jobMocks.runInvoiceGeneration }))
vi.mock('@/jobs/autopay', () => ({ runAutopay: jobMocks.runAutopay }))
vi.mock('@/jobs/delinquency', () => ({ runDelinquency: jobMocks.runDelinquency }))
vi.mock('@/jobs/reminders', () => ({ runReminders: jobMocks.runReminders }))
vi.mock('@/jobs/rate-management', () => ({ runRateManagement: jobMocks.runRateManagement }))
vi.mock('@/jobs/rate-execution', () => ({ runRateExecution: jobMocks.runRateExecution }))
vi.mock('@/jobs/rate-management-reminder', () => ({ runRateManagementReminder: jobMocks.runRateManagementReminder }))
vi.mock('@/jobs/lockout-report-email', () => ({ runLockoutReportEmail: jobMocks.runLockoutReportEmail }))
vi.mock('@/jobs/pdk-reconcile', () => ({ reconcilePdkHolders: jobMocks.reconcilePdkHolders }))

import { GET as listJobs, POST as runJob } from '@/app/api/cron/route'

describe('GET /api/cron — list jobs', () => {
  it('returns the registered jobs with schedule + description', async () => {
    const res = await listJobs(makeRequest('GET', '/api/cron'))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data.jobs)).toBe(true)
    const names = json.data.jobs.map((j: any) => j.name)
    expect(names).toEqual(expect.arrayContaining([
      'generateInvoices', 'autopay', 'delinquency', 'reminders',
      'rateManagement', 'rateExecution', 'rateManagementReminder', 'lockoutReportEmail',
      'pdkReconcile',
    ]))
    expect(json.data.jobs[0]).toHaveProperty('schedule')
  })
})

describe('GET /api/cron?job= — execute job (Vercel cron invocation)', () => {
  beforeEach(() => {
    for (const fn of Object.values(jobMocks)) fn.mockClear()
    delete process.env.CRON_SECRET
  })
  afterEach(() => { delete process.env.CRON_SECRET })

  it('400s on unknown job name', async () => {
    const res = await listJobs(makeRequest('GET', '/api/cron?job=made-up'))
    expect(res.status).toBe(400)
  })

  it('401s when CRON_SECRET is configured but Authorization header is wrong', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    const res = await listJobs(makeRequest('GET', '/api/cron?job=reminders'))
    expect(res.status).toBe(401)
  })

  it('runs the job when CRON_SECRET matches the Bearer header', async () => {
    process.env.CRON_SECRET = 'good-secret'
    const res = await listJobs(makeRequest('GET', '/api/cron?job=reminders', undefined, {
      headers: { authorization: 'Bearer good-secret' } as any,
    }))
    expect(res.status).toBe(200)
    expect(jobMocks.runReminders).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/cron — execute job', () => {
  beforeEach(() => {
    for (const fn of Object.values(jobMocks)) fn.mockClear()
    delete process.env.CRON_SECRET
  })
  afterEach(() => { delete process.env.CRON_SECRET })

  it('400s on unknown job name', async () => {
    const res = await runJob(makeRequest('POST', '/api/cron', { job: 'made-up' }))
    expect(res.status).toBe(400)
  })

  it('400s when no job name is provided', async () => {
    const res = await runJob(makeRequest('POST', '/api/cron', {}))
    expect(res.status).toBe(400)
  })

  it('401s when CRON_SECRET is configured but Authorization header is wrong', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    const res = await runJob(makeRequest('POST', '/api/cron', { job: 'reminders' }))
    expect(res.status).toBe(401)
  })

  it('runs the job when CRON_SECRET matches the Bearer header', async () => {
    process.env.CRON_SECRET = 'good-secret'
    const res = await runJob(makeRequest('POST', '/api/cron', { job: 'reminders' }, {
      headers: { authorization: 'Bearer good-secret' } as any,
    }))
    expect(res.status).toBe(200)
    expect(jobMocks.runReminders).toHaveBeenCalledTimes(1)
  })

  it('runs each registered job by name and returns its result', async () => {
    const res = await runJob(makeRequest('POST', '/api/cron', { job: 'generateInvoices' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual({ job: 'generateInvoices', result: 'invoices-result' })
    expect(jobMocks.runInvoiceGeneration).toHaveBeenCalledTimes(1)
  })

  it('dispatches pdkReconcile to the reconcile job', async () => {
    const res = await runJob(makeRequest('POST', '/api/cron', { job: 'pdkReconcile' }))
    expect(res.status).toBe(200)
    expect(jobMocks.reconcilePdkHolders).toHaveBeenCalledTimes(1)
  })

  it('500s and surfaces the error message when a job throws', async () => {
    jobMocks.runDelinquency.mockRejectedValueOnce(new Error('Mongo unavailable'))
    const res = await runJob(makeRequest('POST', '/api/cron', { job: 'delinquency' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/Mongo unavailable/i)
  })
})
