/**
 * PDK has a two-step token flow: an account-level `id_token` (5 min lifetime)
 * is exchanged for a per-system `system_token` (~1h lifetime) which is then
 * sent as a Bearer header to every `systems.pdk.io/{system_id}/*` call.
 *
 * We cache both tokens in module-level memory with a 30s safety margin so a
 * request that lands right at the edge of expiry still gets a fresh token.
 * Module-level state is fine here because the Next.js server reuses the same
 * process across requests; the cache survives as long as the process does.
 *
 * If PDK ever returns 401 mid-flight (token invalidated server-side, e.g.
 * after a manual integrator revoke), `pdkFetch` does one forced refresh and
 * retries the request. A second 401 propagates to the caller.
 */

const ACCOUNTS_BASE = 'https://accounts.pdk.io'
const SYSTEMS_BASE = 'https://systems.pdk.io'

const TOKEN_REFRESH_MARGIN_MS = 30_000

// PDK does not document the system_token's TTL anywhere. Observed lifetime is
// ~1h; we pessimistically cache for 50 min and lean on the 401-retry below.
const SYSTEM_TOKEN_CACHE_MS = 50 * 60 * 1000

interface CachedToken {
  token: string
  expiresAt: number
}

let cachedIdToken: CachedToken | null = null
const cachedSystemTokens = new Map<string, CachedToken>()

function envOrThrow(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not defined`)
  return v
}

interface IdTokenResponse {
  id_token: string
  expires_in: number
  token_type: string
}

interface SystemTokenResponse {
  token: string
}

export async function getIdToken(): Promise<string> {
  const now = Date.now()
  if (cachedIdToken && cachedIdToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
    return cachedIdToken.token
  }

  const clientId = envOrThrow('PDK_CLIENT_ID')
  const clientSecret = envOrThrow('PDK_CLIENT_SECRET')
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(`${ACCOUNTS_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK id_token request failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as IdTokenResponse
  cachedIdToken = {
    token: data.id_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return cachedIdToken.token
}

export async function getSystemToken(systemId?: string): Promise<string> {
  const sid = systemId ?? envOrThrow('PDK_SYSTEM_ID')
  const now = Date.now()
  const cached = cachedSystemTokens.get(sid)
  if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
    return cached.token
  }

  const idToken = await getIdToken()
  const res = await fetch(`${ACCOUNTS_BASE}/api/systems/${sid}/token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK system_token request failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as SystemTokenResponse
  cachedSystemTokens.set(sid, {
    token: data.token,
    expiresAt: Date.now() + SYSTEM_TOKEN_CACHE_MS,
  })
  return data.token
}

export async function pdkFetch(
  path: string,
  init: RequestInit = {},
  systemId?: string,
): Promise<Response> {
  const sid = systemId ?? envOrThrow('PDK_SYSTEM_ID')
  const token = await getSystemToken(sid)
  const url = path.startsWith('http') ? path : `${SYSTEMS_BASE}/${sid}${path}`

  const doFetch = (bearer: string) =>
    fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${bearer}`,
      },
    })

  const res = await doFetch(token)
  if (res.status !== 401) return res

  // Token was rejected — drop the cache and try once with a fresh one.
  cachedSystemTokens.delete(sid)
  const fresh = await getSystemToken(sid)
  return doFetch(fresh)
}

export function __resetPdkAuthCacheForTests() {
  cachedIdToken = null
  cachedSystemTokens.clear()
}
