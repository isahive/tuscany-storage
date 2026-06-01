import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getIdToken,
  getSystemToken,
  pdkFetch,
  __resetPdkAuthCacheForTests,
} from './pdkAuth'

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ID_TOKEN_RES = { id_token: 'idt-1', expires_in: 300, token_type: 'Bearer' }
const SYS_TOKEN_RES = { token: 'sys-tok-1' }

beforeEach(() => {
  __resetPdkAuthCacheForTests()
  process.env.PDK_CLIENT_ID = 'test-client'
  process.env.PDK_CLIENT_SECRET = 'test-secret'
  process.env.PDK_SYSTEM_ID = 'sys-1'
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getIdToken', () => {
  it('POSTs Basic-auth + grant_type=client_credentials to the OAuth endpoint', async () => {
    const fetchSpy = vi.fn(async () => jsonRes(ID_TOKEN_RES))
    vi.stubGlobal('fetch', fetchSpy)

    const token = await getIdToken()
    expect(token).toBe('idt-1')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://accounts.pdk.io/oauth2/token')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('grant_type=client_credentials')

    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    const decoded = Buffer.from(
      headers.Authorization.replace('Basic ', ''),
      'base64',
    ).toString('utf8')
    expect(decoded).toBe('test-client:test-secret')
  })

  it('caches the id_token across calls within its lifetime', async () => {
    const fetchSpy = vi.fn(async () => jsonRes(ID_TOKEN_RES))
    vi.stubGlobal('fetch', fetchSpy)

    expect(await getIdToken()).toBe('idt-1')
    expect(await getIdToken()).toBe('idt-1')
    expect(await getIdToken()).toBe('idt-1')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('refreshes once the cache passes the safety margin', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.fn(async () => jsonRes(ID_TOKEN_RES))
    vi.stubGlobal('fetch', fetchSpy)

    await getIdToken()
    // expires_in = 300s, margin = 30s → cache invalidates at t=270s
    vi.advanceTimersByTime(269_000)
    await getIdToken()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(2_000) // now at t=271s
    await getIdToken()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('throws when PDK returns non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad creds', { status: 401 })),
    )
    await expect(getIdToken()).rejects.toThrow(/401/)
  })

  it('throws when required env vars are missing', async () => {
    delete process.env.PDK_CLIENT_ID
    vi.stubGlobal('fetch', vi.fn())
    await expect(getIdToken()).rejects.toThrow(/PDK_CLIENT_ID/)
  })
})

describe('getSystemToken', () => {
  it('exchanges the id_token for a per-system token', async () => {
    const fetchSpy = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/oauth2/token')) return jsonRes(ID_TOKEN_RES)
      if (url.endsWith('/api/systems/sys-1/token')) return jsonRes(SYS_TOKEN_RES)
      throw new Error(`unexpected url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchSpy)

    expect(await getSystemToken('sys-1')).toBe('sys-tok-1')

    const sysCall = fetchSpy.mock.calls.find(c =>
      (c[0] as string).includes('/api/systems/'),
    )!
    const init = sysCall[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer idt-1',
    )
  })

  it('caches per system_id independently', async () => {
    const fetchSpy = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/oauth2/token')) return jsonRes(ID_TOKEN_RES)
      if (url.includes('/api/systems/sys-1/token')) return jsonRes({ token: 's1' })
      if (url.includes('/api/systems/sys-2/token')) return jsonRes({ token: 's2' })
      throw new Error(`unexpected url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchSpy)

    expect(await getSystemToken('sys-1')).toBe('s1')
    expect(await getSystemToken('sys-2')).toBe('s2')
    expect(await getSystemToken('sys-1')).toBe('s1') // cached
    expect(await getSystemToken('sys-2')).toBe('s2') // cached

    const sysCalls = fetchSpy.mock.calls.filter(c =>
      (c[0] as string).includes('/api/systems/'),
    )
    expect(sysCalls).toHaveLength(2)
  })

  it('falls back to PDK_SYSTEM_ID env var when no system_id is passed', async () => {
    process.env.PDK_SYSTEM_ID = 'env-sys'
    const fetchSpy = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/oauth2/token')) return jsonRes(ID_TOKEN_RES)
      if (url.includes('/api/systems/env-sys/token')) return jsonRes({ token: 'env-tok' })
      throw new Error(`unexpected url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchSpy)

    expect(await getSystemToken()).toBe('env-tok')
  })
})

describe('pdkFetch', () => {
  it('routes to systems.pdk.io/{system_id}{path} with Bearer system_token', async () => {
    const fetchSpy = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/oauth2/token')) return jsonRes(ID_TOKEN_RES)
      if (url.endsWith('/api/systems/sys-1/token')) return jsonRes(SYS_TOKEN_RES)
      return jsonRes([])
    })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await pdkFetch('/holders')
    expect(res.status).toBe(200)

    const apiCall = fetchSpy.mock.calls.find(c =>
      (c[0] as string).endsWith('/holders'),
    )!
    expect(apiCall[0]).toBe('https://systems.pdk.io/sys-1/holders')
    const headers = (apiCall[1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sys-tok-1')
  })

  it('preserves caller-provided headers and merges Authorization on top', async () => {
    const fetchSpy = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/oauth2/token')) return jsonRes(ID_TOKEN_RES)
      if (url.endsWith('/api/systems/sys-1/token')) return jsonRes(SYS_TOKEN_RES)
      return jsonRes({ id: 'h1' })
    })
    vi.stubGlobal('fetch', fetchSpy)

    await pdkFetch('/holders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Trace': 'abc' },
      body: JSON.stringify({ firstName: 'New' }),
    })

    const apiCall = fetchSpy.mock.calls.find(c =>
      (c[0] as string).endsWith('/holders'),
    )!
    const init = apiCall[1] as RequestInit
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['X-Trace']).toBe('abc')
    expect(headers.Authorization).toBe('Bearer sys-tok-1')
  })

  it('refreshes the system_token on 401 and retries the request once', async () => {
    let sysTokenServed = 0
    let apiCalls = 0
    const fetchSpy = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/oauth2/token')) return jsonRes(ID_TOKEN_RES)
      if (url.endsWith('/api/systems/sys-1/token')) {
        sysTokenServed += 1
        return jsonRes({ token: `sys-${sysTokenServed}` })
      }
      apiCalls += 1
      if (apiCalls === 1) return new Response('expired', { status: 401 })
      return jsonRes([{ id: 'h1' }])
    })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await pdkFetch('/holders')
    expect(res.status).toBe(200)
    expect(sysTokenServed).toBe(2)
    expect(apiCalls).toBe(2)

    const apiCallEntries = fetchSpy.mock.calls.filter(c =>
      (c[0] as string).endsWith('/holders'),
    )
    const lastAuth = (apiCallEntries[1][1] as RequestInit).headers as Record<string, string>
    expect(lastAuth.Authorization).toBe('Bearer sys-2')
  })

  it('does not retry a second time if 401 persists after refresh', async () => {
    const fetchSpy = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/oauth2/token')) return jsonRes(ID_TOKEN_RES)
      if (url.endsWith('/api/systems/sys-1/token')) return jsonRes(SYS_TOKEN_RES)
      return new Response('still expired', { status: 401 })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await pdkFetch('/holders')
    expect(res.status).toBe(401)

    const apiCalls = fetchSpy.mock.calls.filter(c =>
      (c[0] as string).endsWith('/holders'),
    )
    expect(apiCalls).toHaveLength(2)
  })

  it('accepts an absolute URL and routes there directly', async () => {
    const fetchSpy = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/oauth2/token')) return jsonRes(ID_TOKEN_RES)
      if (url.endsWith('/api/systems/sys-1/token')) return jsonRes(SYS_TOKEN_RES)
      return jsonRes([])
    })
    vi.stubGlobal('fetch', fetchSpy)

    await pdkFetch('https://systems.pdk.io/other/holders')
    const apiCall = fetchSpy.mock.calls.find(c =>
      (c[0] as string) === 'https://systems.pdk.io/other/holders',
    )
    expect(apiCall).toBeDefined()
  })
})
