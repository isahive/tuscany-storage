import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { startTestDb, stopTestDb, clearTestDb } from '@/tests/helpers/db'
import { makeRequest } from '@/tests/helpers/request'

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(async () => undefined) }))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => null),
  sendAdminNotification: vi.fn(async () => undefined),
}))

import PasswordResetToken from '@/models/PasswordResetToken'
import { hashToken } from '@/lib/passwordReset'
import { POST as forgot } from '@/app/api/auth/forgot-password/route'
import { POST as reset, GET as resetGet } from '@/app/api/auth/reset-password/route'

async function insertTenant(doc: Record<string, unknown>) {
  const _id = new mongoose.Types.ObjectId()
  const now = new Date()
  await mongoose.connection.collection('tenants').insertOne({
    _id,
    firstName: 'T', lastName: 'T',
    phone: '555',
    role: 'tenant', status: 'active',
    autopayEnabled: false, smsOptIn: false,
    archived: false, onWaitingList: false, isRetailWalkIn: false,
    createdAt: now, updatedAt: now,
    ...doc,
  })
  return _id
}

describe('POST /api/auth/forgot-password', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('returns success:true even for unknown emails (no enumeration)', async () => {
    const req = makeRequest('POST', '/api/auth/forgot-password', { email: 'nobody@x.com' })
    const res = await forgot(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(await PasswordResetToken.countDocuments()).toBe(0)
  })

  it('creates a token (issuedBy:self) for a real tenant', async () => {
    const id = await insertTenant({ email: 'ok@example.com', password: 'hash' })
    const req = makeRequest('POST', '/api/auth/forgot-password', { email: 'ok@example.com' })
    const res = await forgot(req)
    expect(res.status).toBe(200)
    const tokens = await PasswordResetToken.find({ tenantId: id })
    expect(tokens).toHaveLength(1)
    expect(tokens[0].issuedBy).toBe('self')
  })

  it('returns success even on invalid input shape (avoid leaking validation)', async () => {
    const req = makeRequest('POST', '/api/auth/forgot-password', { email: 'not-an-email' })
    const res = await forgot(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('does not issue a token for a loginDisabled account', async () => {
    await insertTenant({ email: 'disabled@x.com', password: 'h', loginDisabled: true })
    const req = makeRequest('POST', '/api/auth/forgot-password', { email: 'disabled@x.com' })
    await forgot(req)
    expect(await PasswordResetToken.countDocuments()).toBe(0)
  })
})

describe('POST /api/auth/reset-password', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  let counter = 0
  async function makeToken(opts: { tenantId: mongoose.Types.ObjectId; expiresInMs?: number; usedAt?: Date }) {
    counter++
    const raw = `token-${counter}-${Math.random().toString(36).slice(2)}`
    await PasswordResetToken.create({
      tenantId: opts.tenantId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 60_000)),
      issuedBy: 'self',
      ...(opts.usedAt ? { usedAt: opts.usedAt } : {}),
    })
    return raw
  }

  it('rejects short passwords (zod min 8)', async () => {
    const id = await insertTenant({ email: 'a@x.com', password: 'h' })
    const tok = await makeToken({ tenantId: id })
    const res = await reset(makeRequest('POST', '/api/auth/reset-password', { token: tok, password: 'short' }))
    expect(res.status).toBe(400)
  })

  it('rejects an expired token', async () => {
    const id = await insertTenant({ email: 'b@x.com', password: 'h' })
    const tok = await makeToken({ tenantId: id, expiresInMs: -1000 })
    const res = await reset(makeRequest('POST', '/api/auth/reset-password', { token: tok, password: 'longpass1234' }))
    expect(res.status).toBe(400)
  })

  it('rejects an already-used token', async () => {
    const id = await insertTenant({ email: 'c@x.com', password: 'h' })
    const tok = await makeToken({ tenantId: id, usedAt: new Date(Date.now() - 1000) })
    const res = await reset(makeRequest('POST', '/api/auth/reset-password', { token: tok, password: 'longpass1234' }))
    expect(res.status).toBe(400)
  })

  it('rejects an unknown token', async () => {
    const res = await reset(makeRequest('POST', '/api/auth/reset-password', { token: 'totally-fake-token-xyz', password: 'longpass1234' }))
    expect(res.status).toBe(400)
  })

  it('on success: stamps the token, updates the password hash, clears loginDisabled', async () => {
    const id = await insertTenant({ email: 'ok@x.com', password: 'old-hash', loginDisabled: true })
    const tok = await makeToken({ tenantId: id })
    const res = await reset(makeRequest('POST', '/api/auth/reset-password', { token: tok, password: 'NewSecret123' }))
    expect(res.status).toBe(200)

    const stored = await mongoose.connection.collection('tenants').findOne({ _id: id })
    expect(stored?.loginDisabled).toBe(false)
    expect(await bcrypt.compare('NewSecret123', stored?.password as string)).toBe(true)

    const usedRecord = await PasswordResetToken.findOne({ tenantId: id })
    expect(usedRecord!.usedAt).toBeInstanceOf(Date)
  })

  it('invalidates other outstanding tokens for the same tenant after a success', async () => {
    const id = await insertTenant({ email: 'multi@x.com', password: 'h' })
    const used = await makeToken({ tenantId: id })
    await makeToken({ tenantId: id }) // a second still-valid token
    const res = await reset(makeRequest('POST', '/api/auth/reset-password', { token: used, password: 'NewSecret123' }))
    expect(res.status).toBe(200)
    const unused = await PasswordResetToken.find({ tenantId: id, usedAt: { $exists: false } })
    expect(unused).toHaveLength(0)
  })
})

describe('GET /api/auth/reset-password', () => {
  beforeAll(async () => { await startTestDb() })
  beforeEach(async () => { await clearTestDb() })
  afterAll(async () => { await stopTestDb() })

  it('returns status:unknown without a token', async () => {
    const req = makeRequest('GET', '/api/auth/reset-password')
    const res = await resetGet(req as any)
    const json = await res.json()
    expect(json.status).toBe('unknown')
  })

  it('returns status:valid for a fresh token', async () => {
    const id = await insertTenant({ email: 'x@x.com', password: 'h' })
    const raw = 'lookup-token-xxxxxx'
    await PasswordResetToken.create({
      tenantId: id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 60_000),
      issuedBy: 'self',
    })
    const req = makeRequest('GET', `/api/auth/reset-password?token=${raw}`)
    const res = await resetGet(req as any)
    const json = await res.json()
    expect(json.status).toBe('valid')
  })

  it('returns status:expired for an expired token', async () => {
    const id = await insertTenant({ email: 'exp@x.com', password: 'h' })
    const raw = 'expired-token-yyyyyy'
    await PasswordResetToken.create({
      tenantId: id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() - 1000),
      issuedBy: 'self',
    })
    const req = makeRequest('GET', `/api/auth/reset-password?token=${raw}`)
    const res = await resetGet(req as any)
    const json = await res.json()
    expect(json.status).toBe('expired')
  })
})
