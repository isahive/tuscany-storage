import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRentedTenant } from '@/tests/helpers/factories'
import { makeRequest, readJson } from '@/tests/helpers/request'
import { adminSession, tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth')
  return { ...actual, getServerSession: vi.fn() }
})
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))
// Stub the dispatcher — receipt routes call it. Verifies channels filter
// + payload without touching Resend / Twilio. vi.hoisted lets us reference
// the spy in the (also hoisted) vi.mock factory.
const { sendTemplatedMock } = vi.hoisted(() => ({
  sendTemplatedMock: vi.fn(async () => undefined),
}))
vi.mock('@/lib/sendNotification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sendNotification')>('@/lib/sendNotification')
  return { ...actual, sendTemplatedNotification: sendTemplatedMock }
})

import { getServerSession } from 'next-auth'
import MoveOutRequest from '@/models/MoveOutRequest'
import Tenant from '@/models/Tenant'
import { GET as getReceipt } from '@/app/api/move-out/[id]/receipt/route'
import { POST as emailReceipt } from '@/app/api/move-out/[id]/receipt/email/route'
import { POST as textReceipt } from '@/app/api/move-out/[id]/receipt/text/route'
import { GET as pdfReceipt } from '@/app/api/move-out/[id]/receipt/pdf/route'

async function setup() {
  const r = await makeRentedTenant()
  const moveOutRequest = await MoveOutRequest.create({
    tenantId: r.tenant._id,
    leaseId: r.lease._id,
    unitId: r.unit._id,
    requestedMoveOutDate: new Date(),
    status: 'approved',
    photoUrls: [],
    guidelines: '',
  })
  return { ...r, moveOutRequest }
}

describe('GET /api/move-out/[id]/receipt', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    sendTemplatedMock.mockClear()
  })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const { moveOutRequest } = await setup()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t-1') as never)
    const req = makeRequest('GET', '')
    const res = await getReceipt(req as any, { params: Promise.resolve({ id: moveOutRequest._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('returns tenant, unit, balance and a rendered template', async () => {
    const { moveOutRequest, unit } = await setup()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const req = makeRequest('GET', '')
    const res = await getReceipt(req as any, { params: Promise.resolve({ id: moveOutRequest._id.toString() }) })
    const json = await readJson<any>(res)
    expect(res.status).toBe(200)
    expect(json.data.unitNumber).toBe(unit.unitNumber)
    expect(json.data.tenant.email).toMatch(/@test\.local/)
    expect(json.data.template).not.toBeNull()
    expect(json.data.template.subject).toBeTruthy()
    expect(json.data.template.emailHtml).toContain(unit.unitNumber)
  })

  it('404s when the request id is unknown', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const req = makeRequest('GET', '')
    const res = await getReceipt(req as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/move-out/[id]/receipt/email', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    sendTemplatedMock.mockClear()
  })
  afterAll(async () => { await stopTestDb() })

  it('forbids non-admins', async () => {
    const { moveOutRequest } = await setup()
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('x') as never)
    const res = await emailReceipt(makeRequest('POST', '') as any, { params: Promise.resolve({ id: moveOutRequest._id.toString() }) })
    expect(res.status).toBe(403)
  })

  it('dispatches via sendTemplatedNotification with channels:email', async () => {
    const { moveOutRequest } = await setup()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await emailReceipt(makeRequest('POST', '') as any, { params: Promise.resolve({ id: moveOutRequest._id.toString() }) })
    expect(res.status).toBe(200)
    expect(sendTemplatedMock).toHaveBeenCalledTimes(1)
    expect(sendTemplatedMock.mock.calls[0][0]).toMatchObject({
      templateName: 'Move Out Receipt',
      channels: 'email',
    })
  })

  it('400s when tenant has no email on file', async () => {
    const { moveOutRequest, tenant } = await setup()
    await Tenant.findByIdAndUpdate(tenant._id, { email: '' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await emailReceipt(makeRequest('POST', '') as any, { params: Promise.resolve({ id: moveOutRequest._id.toString() }) })
    expect(res.status).toBe(400)
    expect(sendTemplatedMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/move-out/[id]/receipt/text', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
    sendTemplatedMock.mockClear()
  })
  afterAll(async () => { await stopTestDb() })

  it('dispatches with channels:sms when phone is on file', async () => {
    const { moveOutRequest } = await setup()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await textReceipt(makeRequest('POST', '') as any, { params: Promise.resolve({ id: moveOutRequest._id.toString() }) })
    expect(res.status).toBe(200)
    expect(sendTemplatedMock.mock.calls[0][0]).toMatchObject({ channels: 'sms' })
  })

  it('400s when tenant has no phone on file', async () => {
    const { moveOutRequest, tenant } = await setup()
    await Tenant.findByIdAndUpdate(tenant._id, { phone: '' })
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await textReceipt(makeRequest('POST', '') as any, { params: Promise.resolve({ id: moveOutRequest._id.toString() }) })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/move-out/[id]/receipt/pdf', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => {
    await clearTestDb()
    vi.mocked(getServerSession).mockReset()
  })
  afterAll(async () => { await stopTestDb() })

  it('returns a PDF with the correct content-type + disposition', async () => {
    const { moveOutRequest } = await setup()
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await pdfReceipt(makeRequest('GET', '') as any, { params: Promise.resolve({ id: moveOutRequest._id.toString() }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toMatch(/attachment;.*\.pdf/)
    const body = await res.arrayBuffer()
    expect(body.byteLength).toBeGreaterThan(100)
    // PDF magic header bytes
    const header = new TextDecoder().decode(new Uint8Array(body, 0, 4))
    expect(header).toBe('%PDF')
  })

  it('404s on unknown id', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession() as never)
    const res = await pdfReceipt(makeRequest('GET', '') as any, { params: Promise.resolve({ id: '507f1f77bcf86cd799439099' }) })
    expect(res.status).toBe(404)
  })
})
