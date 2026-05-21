import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'
import { revokeAccess, grantAccess } from './gateController'

const TENANT = { _id: new Types.ObjectId(), gateCode: '1234' } as any
const SETTINGS_WIRED = {
  gateApiEndpoint: 'https://gate.example.com/api',
  gateApiKey: 'k-secret',
  gateNodeId: 'node-7',
} as any
const SETTINGS_UNWIRED = {} as any

describe('gateController', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('returns false when no gate endpoint is configured (no fetch attempted)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await revokeAccess(TENANT, SETTINGS_UNWIRED, 'lockout')).toBe(false)
    expect(await grantAccess(TENANT, SETTINGS_UNWIRED, 'payment_received')).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('POSTs the right payload + auth header on revoke', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => '' } as Response))
    vi.stubGlobal('fetch', fetchSpy)

    const ok = await revokeAccess(TENANT, SETTINGS_WIRED, 'lockout')
    expect(ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://gate.example.com/api',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer k-secret',
          'X-Gate-Node': 'node-7',
        }),
      }),
    )
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toMatchObject({ action: 'revoke', gateCode: '1234', reason: 'lockout' })
    expect(body.tenantId).toBe(String(TENANT._id))
  })

  it('returns true on grant when gate responds ok', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => '' } as Response))
    vi.stubGlobal('fetch', fetchSpy)
    expect(await grantAccess(TENANT, SETTINGS_WIRED, 'payment_received')).toBe(true)
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.action).toBe('grant')
  })

  it('returns false when gate responds non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => 'gate down' } as Response)))
    expect(await revokeAccess(TENANT, SETTINGS_WIRED, 'lockout')).toBe(false)
  })

  it('returns false when fetch throws (network)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET') }))
    expect(await grantAccess(TENANT, SETTINGS_WIRED)).toBe(false)
  })

  it('omits X-Gate-Node header when gateNodeId is unset', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => '' } as Response))
    vi.stubGlobal('fetch', fetchSpy)
    const noNode = { gateApiEndpoint: 'https://x', gateApiKey: 'k' } as any
    await revokeAccess(TENANT, noNode)
    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['X-Gate-Node']).toBeUndefined()
  })

  it('serializes null gateCode when tenant has none', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, text: async () => '' } as Response))
    vi.stubGlobal('fetch', fetchSpy)
    const noCode = { _id: new Types.ObjectId() } as any
    await revokeAccess(noCode, SETTINGS_WIRED)
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.gateCode).toBeNull()
  })
})
